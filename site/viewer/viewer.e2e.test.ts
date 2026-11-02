// The viewer in a real browser (headless Chromium through playwright-core):
// the built site served from www/, WebGL on SwiftShader.
//
//   DRAMATIS_BROWSER=1 bun test site/viewer          viewer: URL, picker, drop, handoff
//   DRAMATIS_BROWSER=1 DRAMATIS_NETWORK=1 bun test site/viewer
//                                                    + creator -> View in three.js -> viewer
//                                                    + creator -> View in Unity -> Unity player
//
// Without DRAMATIS_BROWSER every test here is skipped: NOT RUN, never passed.
// The browser is Playwright's Chromium (`bunx playwright-core install
// chromium` once); the site is built first (`bun bin/site.ts --build`).
//
// "Animating" is measured, not assumed: the left hand's world position is
// read twice, half a second apart, and must have moved; the face unit's
// morph influence must be what the page set.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import type { Browser, Page } from 'playwright-core'
import {
  HANDOFF_DB,
  HANDOFF_DB_VERSION,
  HANDOFF_STORE,
} from '../../src/contracts/handoff'

const BROWSER = process.env.DRAMATIS_BROWSER === '1'
const NETWORK = process.env.DRAMATIS_NETWORK === '1'
const ROOT = join(import.meta.dir, '..', '..')
const WWW = join(ROOT, 'www')
const SAMPLES = join(ROOT, 'samples', 'out')
const SHOTS = join(ROOT, '.cache', 'e2e')

if (!BROWSER)
  console.log(
    'viewer e2e: NOT RUN (set DRAMATIS_BROWSER=1; the creator path also needs DRAMATIS_NETWORK=1)'
  )

let browser: Browser
let server: ReturnType<typeof Bun.serve>
let base = ''

/** www/ as a static host serves it (GitHub Pages), plus samples/out at /samples/. */
function serve(): ReturnType<typeof Bun.serve> {
  const file = (dir: string, path: string): string | null => {
    const full = normalize(join(dir, decodeURIComponent(path)))
    if (!full.startsWith(dir)) return null
    for (const candidate of [full, `${full}.html`, join(full, 'index.html')])
      if (existsSync(candidate) && statSync(candidate).isFile())
        return candidate
    return null
  }
  return Bun.serve({
    port: 0,
    fetch(req: Request) {
      const { pathname } = new URL(req.url)
      const found = pathname.startsWith('/samples/')
        ? file(SAMPLES, pathname.slice('/samples/'.length))
        : file(WWW, pathname)
      return found
        ? new Response(Bun.file(found))
        : new Response('not found', { status: 404 })
    },
  })
}

interface ViewerState {
  status: string
  error: boolean
  name: string | null
  source: string | null
  naming: string | null
  dramatis: boolean
  clip: string | null
  clipOk: boolean
  clipSummary: string
  playing: boolean
  faceUnits: number
  licences: { asset: string; kind: string; attribution?: string }[]
  frames: number
}

const viewerState = (page: Page) =>
  page.evaluate(
    () =>
      (globalThis as unknown as { dramatisViewer: { state: ViewerState } })
        .dramatisViewer.state
  )

/** Wait until the viewer has a model playing a clip (or has failed). */
async function playing(page: Page, timeout = 60_000): Promise<ViewerState> {
  await page.waitForFunction(
    () => {
      const v = (globalThis as Record<string, unknown>).dramatisViewer as
        | { state: ViewerState }
        | undefined
      return v && (v.state.playing || v.state.error)
    },
    undefined,
    { timeout }
  )
  return viewerState(page)
}

/**
 * How far the hand travels from where it first was, read every 100 ms for up
 * to 4 s of drawn frames (SwiftShader draws a 5 MB character at a few frames
 * a second, and the first frames wait on shader compiles). Stops once it has
 * moved 5 cm. Frames must be drawn throughout.
 */
async function animating(page: Page, hand = 'hand_l'): Promise<number> {
  type V = {
    jointWorld(ue: string): number[] | null
    state: { frames: number }
  }
  const read = () =>
    page.evaluate((ue) => {
      const v = (globalThis as unknown as { dramatisViewer: V }).dramatisViewer
      return { p: v.jointWorld(ue), frames: v.state.frames }
    }, hand)
  const first = await read()
  expect(first.p).not.toBeNull()
  let furthest = 0
  let last = first
  for (let i = 0; i < 40 && furthest < 0.05; i++) {
    await page.waitForTimeout(100)
    last = await read()
    const d = Math.hypot(...first.p!.map((x, j) => x - last.p![j]!))
    furthest = Math.max(furthest, d)
  }
  expect(last.frames).toBeGreaterThan(first.frames)
  return furthest
}

async function newPage(): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { page, errors }
}

describe.skipIf(!BROWSER)('the viewer in Chromium', () => {
  beforeAll(async () => {
    const build = Bun.spawnSync(['bun', 'bin/site.ts', '--build'], {
      cwd: ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
    })
    if (build.exitCode !== 0) throw new Error('site build failed')
    mkdirSync(SHOTS, { recursive: true })
    server = serve()
    base = server.url.href.replace(/\/$/, '')
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch({
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    })
  }, 120_000)

  // After the long SwiftShader tests, a graceful close can overrun bun's default 5 s hook
  // timeout on a CI runner (run 41372324731: every test passed, then teardown failed). Give
  // it a budget and stop waiting; bun reaps the dangling process ("killed 1 dangling process").
  afterAll(async () => {
    const closed = browser?.close().then(() => true) ?? Promise.resolve(true)
    await Promise.race([
      closed,
      new Promise<false>((r) => setTimeout(() => r(false), 20_000)),
    ])
    server?.stop(true)
  }, 30_000)

  test('/viewer/ is a page (the creator checks with HEAD)', async () => {
    const r = await fetch(`${base}/viewer/`, { method: 'HEAD' })
    expect(r.status).toBe(200)
  })

  test('?glb=: a Dramatis export walks, its jaw opens, its licences show', async () => {
    const { page, errors } = await newPage()
    await page.goto(`${base}/viewer/?glb=/samples/clothed-casual.glb`)
    const s = await playing(page)
    expect(s.error).toBe(false)
    expect(s.dramatis).toBe(true)
    expect(s.naming).toBe('ue')
    expect(s.clip).toBe('Walk_Loop')
    expect(s.clipOk).toBe(true)
    expect(s.clipSummary).toContain('no retargeting')
    expect(await animating(page)).toBeGreaterThan(0.01)
    const jaw = await page.evaluate(() =>
      (
        globalThis as unknown as {
          dramatisViewer: { faceUnitWeight(u: string): number | null }
        }
      ).dramatisViewer.faceUnitWeight('JawDrop')
    )
    expect(jaw).toBeCloseTo(0.35, 5)
    const items = await page.locator('#licences li').count()
    expect(items).toBe(s.licences.length)
    expect(items).toBeGreaterThan(1)
    const shown = await page.locator('#licences').innerText()
    expect(shown).toContain('CC0-1.0')
    // A CC BY credit line is shown word for word.
    for (const l of s.licences)
      if (l.attribution) expect(shown).toContain(l.attribution)
    await page.screenshot({ path: join(SHOTS, 'viewer-url.png') })
    // Phone width: the panel moves to the bottom; nothing scrolls sideways.
    await page.setViewportSize({ width: 390, height: 780 })
    await page.waitForTimeout(300)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await page.screenshot({ path: join(SHOTS, 'viewer-phone.png') })
    expect(errors).toEqual([])
    await page.close()
  }, 90_000)

  test('file picker: a Mixamo-named export, the clip renamed, not retargeted', async () => {
    const { page, errors } = await newPage()
    await page.goto(`${base}/viewer/`)
    await page.setInputFiles(
      '#file',
      join(SAMPLES, 'clothed-casual-mixamo.glb')
    )
    const s = await playing(page)
    expect(s.source).toBe('file')
    expect(s.naming).toBe('mixamo')
    expect(s.clipOk).toBe(true)
    expect(s.clipSummary).toContain('renamed')
    expect(await animating(page)).toBeGreaterThan(0.01)
    expect(errors).toEqual([])
    await page.close()
  }, 90_000)

  test('drag and drop', async () => {
    const { page, errors } = await newPage()
    await page.goto(`${base}/viewer/`)
    const bytes = [...readFileSync(join(SAMPLES, 'long-hair.glb'))]
    // A real DataTransfer with a File in it, dropped on the page.
    await page.evaluate((data) => {
      const dt = new DataTransfer()
      dt.items.add(
        new File([new Uint8Array(data)], 'long-hair.glb', {
          type: 'model/gltf-binary',
        })
      )
      window.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, cancelable: true })
      )
    }, bytes)
    const s = await playing(page)
    expect(s.source).toBe('file')
    expect(s.clipOk).toBe(true)
    expect(await animating(page)).toBeGreaterThan(0.01)
    expect(errors).toEqual([])
    await page.close()
  }, 90_000)

  test('handoff: an entry put as the contract says opens by ?handoff=', async () => {
    const { page, errors } = await newPage()
    await page.goto(`${base}/viewer/`)
    const bytes = [...readFileSync(join(SAMPLES, 'extreme-heavy.glb'))]
    const id = await page.evaluate(
      async ({ data, db, store, version }) => {
        const open = indexedDB.open(db, version)
        open.onupgradeneeded = () =>
          open.result.createObjectStore(store, { keyPath: 'id' })
        const conn: IDBDatabase = await new Promise((ok, no) => {
          open.onsuccess = () => ok(open.result)
          open.onerror = () => no(open.error)
        })
        const id = crypto.randomUUID()
        await new Promise((ok, no) => {
          const tx = conn.transaction(store, 'readwrite')
          tx.objectStore(store).put({
            id,
            glb: new Uint8Array(data),
            fileName: 'extreme-heavy.glb',
            character: 'extreme heavy',
            licences: [],
            created: Date.now(),
          })
          tx.oncomplete = ok
          tx.onerror = () => no(tx.error)
        })
        conn.close()
        return id
      },
      {
        data: bytes,
        db: HANDOFF_DB,
        store: HANDOFF_STORE,
        version: HANDOFF_DB_VERSION,
      }
    )
    await page.goto(`${base}/viewer/?handoff=${id}`)
    const s = await playing(page)
    expect(s.source).toBe('handoff')
    expect(s.clipOk).toBe(true)
    expect(await animating(page)).toBeGreaterThan(0.01)
    // A reload finds it again (the entry is not deleted on read).
    await page.reload()
    expect((await playing(page)).source).toBe('handoff')
    // An unknown id says so.
    await page.goto(`${base}/viewer/?handoff=nope`)
    await page.waitForFunction(() =>
      (
        globalThis as unknown as { dramatisViewer: { state: ViewerState } }
      ).dramatisViewer.state.status.includes('isn’t here')
    )
    expect(errors).toEqual([])
    await page.close()
  }, 90_000)

  test.skipIf(!NETWORK)(
    'creator -> View in three.js -> the viewer shows the character animating',
    async () => {
      const { page, errors } = await newPage()
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`)
      })
      await page.goto(`${base}/creator/`)
      const view = page.getByRole('button', { name: 'View in three.js' })
      await view.waitFor({ state: 'visible', timeout: 60_000 })
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('dramatis-creator button')].some(
            (b) =>
              b.textContent === 'View in three.js' &&
              !(b as HTMLButtonElement).disabled
          ),
        undefined,
        { timeout: 240_000 }
      )
      await page.screenshot({ path: join(SHOTS, 'creator.png') })
      const [viewer] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 120_000 }),
        view.click(),
      ])
      viewer.on('pageerror', (e) => errors.push(`viewer: ${e.message}`))
      await viewer.waitForURL(/\/viewer\/\?handoff=/, { timeout: 180_000 })
      const s = await playing(viewer, 120_000)
      expect(s.error).toBe(false)
      expect(s.source).toBe('handoff')
      expect(s.dramatis).toBe(true)
      expect(s.clipOk).toBe(true)
      expect(s.licences.some((l) => l.kind === 'base')).toBe(true)
      expect(await animating(viewer)).toBeGreaterThan(0.01)
      await viewer.screenshot({ path: join(SHOTS, 'creator-to-viewer.png') })

      // The rest of UAL volume 1 from the CDN: every clip binds by name.
      await viewer.selectOption('#clip', 'more')
      await viewer.waitForFunction(
        () => document.querySelectorAll('#clip option').length > 30,
        undefined,
        { timeout: 120_000 }
      )
      await viewer.selectOption('#clip', 'core:Dance_Loop')
      await viewer.waitForFunction(
        () =>
          (globalThis as unknown as { dramatisViewer: { state: ViewerState } })
            .dramatisViewer.state.clip === 'Dance_Loop',
        undefined,
        { timeout: 60_000 }
      )
      const dance = await viewerState(viewer)
      expect(dance.clipOk).toBe(true)
      expect(await animating(viewer)).toBeGreaterThan(0.01)
      const status = await page
        .locator('dramatis-creator .dc-status')
        .innerText()
      expect(status).toContain('Opened')
      expect(errors.filter((e) => !e.startsWith('console:'))).toEqual([])
      if (errors.length) console.log('console errors (not failing):', errors)
    },
    420_000
  )

  test.skipIf(!NETWORK)(
    'creator -> View in Unity -> the Unity player loads the character with its gaits',
    async () => {
      const { page, errors } = await newPage()
      await page.goto(`${base}/creator/`)
      const view = page.getByRole('button', { name: 'View in Unity' })
      await view.waitFor({ state: 'visible', timeout: 60_000 })
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('dramatis-creator button')].some(
            (b) =>
              b.textContent === 'View in Unity' &&
              !(b as HTMLButtonElement).disabled
          ),
        undefined,
        { timeout: 240_000 }
      )
      const [player] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 120_000 }),
        view.click(),
      ])
      player.on('pageerror', (e) => errors.push(`unity: ${e.message}`))
      await player.waitForURL(/\/unity\/\?handoff=/, { timeout: 180_000 })
      type U = {
        error: boolean
        status: string
        built: boolean
        ready: boolean
        name: string | null
        clips: string[]
      }
      await player.waitForFunction(
        () => {
          const u = (globalThis as unknown as { dramatisUnity?: U })
            .dramatisUnity
          return u && (u.clips.length > 0 || u.error)
        },
        undefined,
        { timeout: 240_000 }
      )
      const u = await player.evaluate(
        () => (globalThis as unknown as { dramatisUnity: U }).dramatisUnity
      )
      expect([u.error, u.status]).toEqual([false, u.status])
      expect(u.built && u.ready).toBe(true)
      expect(u.name).toBeTruthy()
      expect(u.clips).toEqual(
        expect.arrayContaining(['idle', 'walk', 'jog', 'sprint'])
      )
      await player.screenshot({ path: join(SHOTS, 'creator-to-unity.png') })
      const status = await page
        .locator('dramatis-creator .dc-status')
        .innerText()
      expect(status).toContain('in the Unity player')
      expect(errors.filter((e) => !e.startsWith('console:'))).toEqual([])
    },
    600_000
  )

  // Babylon forgets every material plugin when its last engine goes (the doc
  // browser disposes the creator's scene on leaving the page); tosijs-3d 0.12
  // registers them again, so a second visit still has skin shading.
  test.skipIf(!NETWORK)(
    'creator -> another page -> creator again: skin shading, no plugin errors',
    async () => {
      const { page, errors } = await newPage()
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`)
      })
      /** The creator's character is up, and its skin is shaded. */
      const shaded = async (): Promise<boolean> => {
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('dramatis-creator button')].some(
              (b) =>
                b.textContent === 'View in three.js' &&
                !(b as HTMLButtonElement).disabled
            ),
          undefined,
          { timeout: 240_000 }
        )
        return page.evaluate(() => {
          type Plugin = { isEnabled: boolean } | null
          type Mat = {
            pluginManager?: { getPlugin(n: string): Plugin }
          }
          const host = document.querySelector('tosi-b3d') as unknown as {
            scene?: { materials: Mat[] }
          } | null
          return (host?.scene?.materials ?? []).some(
            (m) => m.pluginManager?.getPlugin('SkinShading')?.isEnabled === true
          )
        })
      }
      await page.goto(`${base}/creator/`)
      expect(await shaded()).toBe(true)
      // Leave by the doc browser's own navigation, which disposes the scene.
      await page
        .locator('a[href="/licences/"]')
        .filter({ visible: true })
        .first()
        .click()
      await page.waitForFunction(
        () => document.querySelector('dramatis-creator') === null,
        undefined,
        { timeout: 60_000 }
      )
      await page.waitForTimeout(500)
      await page.goBack()
      await page.waitForFunction(
        () => document.querySelector('dramatis-creator') !== null,
        undefined,
        { timeout: 60_000 }
      )
      expect(await shaded()).toBe(true)
      await page.screenshot({ path: join(SHOTS, 'creator-again.png') })
      expect(errors.filter((e) => /plugin not registered/.test(e))).toEqual([])
      expect(errors.filter((e) => !e.startsWith('console:'))).toEqual([])
      if (errors.length) console.log('console errors (not failing):', errors)
      await page.close()
    },
    600_000
  )

  // --- the demo (/demo/): the same server and browser ---------------------------

  interface DemoState {
    status: string
    error: boolean
    name: string | null
    gait: string
    at: { x: number; z: number }
    clips: string[]
    frames: number
  }
  const demoState = (page: Page) =>
    page.evaluate(
      () => (globalThis as unknown as { dramatisDemo: DemoState }).dramatisDemo
    )
  /** Wait until the demo has a character with clips (or has failed). */
  async function demoReady(page: Page, timeout = 90_000): Promise<DemoState> {
    await page.waitForFunction(
      () => {
        const s = (globalThis as Record<string, unknown>).dramatisDemo as
          | DemoState
          | undefined
        return s && (s.error || s.clips.length > 0)
      },
      undefined,
      { timeout }
    )
    return demoState(page)
  }

  test('demo: ?glb= stands an export up, W walks it, letting go stops it', async () => {
    const { page, errors } = await newPage()
    // Not the load event: on CI's SwiftShader the first frames (shadows, the
    // environment) can hold it past goto's 30 s (run 41401524373).
    await page.goto(`${base}/demo/?glb=/samples/clothed-casual.glb`, {
      waitUntil: 'domcontentloaded',
    })
    const s = await demoReady(page)
    expect(s.error).toBe(false)
    // Offline, only the bundled walk; with the CDN, all four.
    expect(s.clips).toContain('walk')
    if (NETWORK) expect(s.clips).toEqual(['idle', 'walk', 'jog', 'sprint'])
    expect(s.at).toEqual({ x: 0, z: 0 })
    await page.locator('canvas').click({ position: { x: 5, y: 5 } }) // focus, a click off the floor
    await page.keyboard.down('KeyW')
    await page.waitForFunction(
      () => {
        const d = (globalThis as unknown as { dramatisDemo: DemoState })
          .dramatisDemo
        return Math.hypot(d.at.x, d.at.z) > 0.5 && d.gait === 'walk'
      },
      undefined,
      { timeout: 30_000 }
    )
    await page.keyboard.up('KeyW')
    await page.waitForFunction(
      () =>
        (globalThis as unknown as { dramatisDemo: DemoState }).dramatisDemo
          .gait === 'idle',
      undefined,
      { timeout: 30_000 }
    )
    expect(await page.locator('#licences li').count()).toBeGreaterThan(1)
    await page.screenshot({ path: join(SHOTS, 'demo-glb.png') })
    await page.setViewportSize({ width: 390, height: 780 })
    await page.waitForTimeout(300)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    expect(errors).toEqual([])
    await page.close()
  }, 120_000)

  test.skipIf(!NETWORK)(
    'demo: with nothing saved, a default character is built here and walks',
    async () => {
      const { page, errors } = await newPage()
      await page.goto(`${base}/demo/`, { waitUntil: 'domcontentloaded' })
      const s = await demoReady(page, 240_000)
      expect(s.error).toBe(false)
      expect(s.name).toBe('Default character')
      expect(s.clips).toEqual(['idle', 'walk', 'jog', 'sprint'])
      expect(s.gait).toBe('idle')
      expect(errors).toEqual([])
      await page.close()
    },
    300_000
  )
})

describe.skipIf(!BROWSER)('samples/three-glb in Chromium', () => {
  test('loads the GLB, lists its licences, and the picture moves', async () => {
    const { chromium } = await import('playwright-core')
    const port = 18000 + Math.floor(Math.random() * 1000)
    const proc = Bun.spawn(
      ['bun', 'samples/three-glb/serve.ts', '--port', String(port)],
      { cwd: ROOT, stdout: 'pipe', stderr: 'inherit' }
    )
    const own = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    })
    try {
      // Wait for the server's first line.
      const reader = proc.stdout.getReader()
      await reader.read()
      reader.releaseLock()
      const page = await own.newPage({ viewport: { width: 640, height: 480 } })
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`http://localhost:${port}/`)
      await page.waitForFunction(
        () => document.querySelectorAll('#licences li').length > 1,
        undefined,
        { timeout: 60_000 }
      )
      expect(await page.locator('#name').innerText()).toBe('Clothed, casual')
      // Animating: two pictures of the canvas a moment apart differ.
      let moved = false
      const first = await page.locator('canvas').screenshot()
      for (let i = 0; i < 20 && !moved; i++) {
        await page.waitForTimeout(150)
        const next = await page.locator('canvas').screenshot()
        moved = !first.equals(next)
      }
      expect(moved).toBe(true)
      await page.screenshot({ path: join(SHOTS, 'sample-three-glb.png') })
      expect(errors).toEqual([])
    } finally {
      await own.close()
      proc.kill()
    }
  }, 90_000)
})
