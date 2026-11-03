// A mid-range phone, emulated: what the phone budget (#3654) is measured on.
// Lighthouse's mobile profile: the CPU slowed 4x, "slow 4G" (150 ms round
// trip, 1.6 Mb/s down, 750 kb/s up), a 412 x 823 screen at 2.625x. No real
// phone is in the loop, so the numbers are the emulation's, not a device's;
// the GPU is SwiftShader (on the CPU), so frames cost more than on a phone.
//
//   bun tools/perf/phone.ts [--base https://dramatis.tosijs.net] [--fast]
//
// Without --base it builds www/ and serves it (and samples/out at /samples/)
// on a local port; the CDN packs come from cdn.tosijs.net either way.
// --fast skips the throttling (the desktop numbers, for comparison).

import { existsSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import type { Browser, CDPSession, Page } from 'playwright-core'

export const PHONE = {
  cpuSlowdown: 4,
  latencyMs: 150,
  downBytesPerSec: (1.6 * 1024 * 1024) / 8,
  upBytesPerSec: (750 * 1024) / 8,
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 2.625,
  userAgent:
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
} as const

export interface PageCost {
  /** First contentful paint, ms from navigation. */
  fcpMs: number | null
  /** When the page's own "useful" condition held, ms from navigation. */
  usefulMs: number
  /** When it was ready (the character up), ms from navigation. */
  readyMs: number
  /** Bytes over the wire (encoded), to ready. */
  transferBytes: number
  /** The largest JS heap seen (used), to ready. */
  peakHeapBytes: number
  /** Bytes by URL (query dropped), largest first. */
  byUrl: [string, number][]
}

export interface Probe {
  name: string
  path: string
  /** Page-side condition for "useful": something to look at or press. */
  useful: string
  /** Page-side condition for "ready": the character is up. */
  ready: string
}

const VIEWER_PLAYING = '(globalThis.dramatisViewer?.state.playing === true)'
const CREATOR_BUTTON = (enabled: boolean) =>
  `[...document.querySelectorAll('dramatis-creator button')].some(b => b.textContent === 'View in three.js'${
    enabled ? ' && !b.disabled' : ''
  })`

export const PROBES: Probe[] = [
  {
    name: 'landing',
    path: '/',
    useful: "!!document.querySelector('h1, main')",
    ready: "document.readyState === 'complete'",
  },
  {
    name: 'creator',
    path: '/creator/',
    useful: CREATOR_BUTTON(false),
    ready: CREATOR_BUTTON(true),
  },
  {
    // Nothing saved in a fresh profile: the demo builds a default character
    // with the engine-free library (the pack, no hair library, no Babylon).
    name: 'demo',
    path: '/demo/',
    useful: "!!document.querySelector('canvas')",
    ready:
      '(globalThis.dramatisDemo?.name != null && globalThis.dramatisDemo.clips.length > 0)',
  },
  {
    // Local only: the sample export is served from samples/out.
    name: 'viewer',
    path: '/viewer/?glb=/samples/clothed-casual.glb',
    useful: "!!document.getElementById('status')?.textContent",
    ready: VIEWER_PLAYING,
  },
]

async function throttle(
  cdp: CDPSession,
  cpu: boolean,
  network: boolean
): Promise<void> {
  await cdp.send('Network.enable')
  if (cpu)
    await cdp.send('Emulation.setCPUThrottlingRate', {
      rate: PHONE.cpuSlowdown,
    })
  if (network)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: PHONE.latencyMs,
      downloadThroughput: PHONE.downBytesPerSec,
      uploadThroughput: PHONE.upBytesPerSec,
    })
}

/** Load one probe in `page` (fresh or warm) and measure it. */
export async function measure(
  page: Page,
  base: string,
  probe: Probe,
  options: { phone?: boolean; network?: boolean; timeoutMs?: number } = {}
): Promise<PageCost> {
  const cdp = await page.context().newCDPSession(page)
  const phone = options.phone ?? true
  await throttle(cdp, phone, phone && (options.network ?? true))
  await cdp.send('Performance.enable')
  let transferBytes = 0
  const urls = new Map<string, string>()
  const byUrl = new Map<string, number>()
  cdp.on('Network.requestWillBeSent', (e) => {
    if (!e.request.url.startsWith('data:'))
      urls.set(e.requestId, e.request.url.split('?')[0]!)
  })
  cdp.on('Network.loadingFinished', (e) => {
    transferBytes += e.encodedDataLength
    const u = urls.get(e.requestId)
    if (!u) return
    byUrl.set(u, (byUrl.get(u) ?? 0) + e.encodedDataLength)
  })
  let peakHeapBytes = 0
  const sample = async () => {
    try {
      const { metrics } = await cdp.send('Performance.getMetrics')
      const used = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0
      peakHeapBytes = Math.max(peakHeapBytes, used)
    } catch {}
  }
  const sampler = setInterval(sample, 250)
  const timeout = options.timeoutMs ?? 300_000
  const start = Date.now()
  try {
    await page.goto(base + probe.path, { waitUntil: 'commit', timeout })
    await page.waitForFunction(probe.useful, undefined, {
      timeout,
      polling: 50,
    })
    const usefulMs = Date.now() - start
    await page.waitForFunction(probe.ready, undefined, {
      timeout,
      polling: 100,
    })
    const readyMs = Date.now() - start
    await sample()
    const fcpMs = await page.evaluate(
      () =>
        performance
          .getEntriesByType('paint')
          .find((e) => e.name === 'first-contentful-paint')?.startTime ?? null
    )
    return {
      fcpMs,
      usefulMs,
      readyMs,
      transferBytes,
      peakHeapBytes,
      byUrl: [...byUrl].sort((a, b) => b[1] - a[1]),
    }
  } finally {
    clearInterval(sampler)
    await cdp.detach().catch(() => {})
  }
}

export async function launch(): Promise<Browser> {
  const { chromium } = await import('playwright-core')
  return chromium.launch({ args: ARGS })
}

const ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-precise-memory-info',
]

/** A phone-shaped browser with its own profile (and disk cache) in `dir`. */
export async function persistentPhone(dir: string) {
  const { chromium } = await import('playwright-core')
  return chromium.launchPersistentContext(dir, {
    args: ARGS,
    viewport: PHONE.viewport,
    deviceScaleFactor: PHONE.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent: PHONE.userAgent,
  })
}

export async function phoneContext(browser: Browser) {
  return browser.newContext({
    viewport: PHONE.viewport,
    deviceScaleFactor: PHONE.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent: PHONE.userAgent,
  })
}

const ROOT = join(import.meta.dir, '..', '..')

/** Build the site into www/ (bin/site.ts --build). */
export function buildSite(): void {
  const built = Bun.spawnSync(['bun', 'bin/site.ts', '--build'], {
    cwd: ROOT,
    stdout: 'ignore',
    stderr: 'inherit',
  })
  if (built.exitCode !== 0) throw new Error('site build failed')
}

/** Text the host compresses, as GitHub Pages does (a .glb it does not). */
const COMPRESSED = /\.(html|js|css|json|svg|txt|md)$/

/**
 * www/ as GitHub Pages serves it (samples/out at /samples/), gzipping text,
 * so bytes over the wire are close to the live site's.
 */
export function serveSite(): ReturnType<typeof Bun.serve> {
  const WWW = join(ROOT, 'www')
  const SAMPLES = join(ROOT, 'samples', 'out')
  const file = (dir: string, path: string) => {
    const full = normalize(join(dir, decodeURIComponent(path)))
    if (!full.startsWith(dir)) return null
    for (const c of [full, `${full}.html`, join(full, 'index.html')])
      if (existsSync(c) && statSync(c).isFile()) return c
    return null
  }
  return Bun.serve({
    port: 0,
    async fetch(req: Request) {
      const { pathname } = new URL(req.url)
      const found = pathname.startsWith('/samples/')
        ? file(SAMPLES, pathname.slice(9))
        : file(WWW, pathname)
      if (!found) return new Response('not found', { status: 404 })
      const f = Bun.file(found)
      const type = f.type
      if (
        COMPRESSED.test(found) &&
        /gzip/.test(req.headers.get('accept-encoding') ?? '')
      )
        return new Response(Bun.gzipSync(await f.bytes()), {
          headers: { 'content-encoding': 'gzip', 'content-type': type },
        })
      return new Response(f)
    },
  })
}

const mb = (b: number) => `${(b / 2 ** 20).toFixed(2)} MB`
const s = (ms: number | null) =>
  ms === null ? '-' : `${(ms / 1000).toFixed(1)} s`

if (import.meta.main) {
  const arg = (n: string) => {
    const i = process.argv.indexOf(n)
    return i > 0 ? process.argv[i + 1] : undefined
  }
  const phone = !process.argv.includes('--fast')
  let base: string = arg('--base') ?? ''
  let server: ReturnType<typeof Bun.serve> | null = null
  if (!base) {
    buildSite()
    server = serveSite()
    base = server.url.href.replace(/\/$/, '')
  }
  console.log(
    `${
      phone ? 'emulated phone (4x CPU, slow 4G)' : 'desktop, unthrottled'
    } against ${base}`
  )
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const only = arg('--only')
  const live = !!arg('--base')
  for (const probe of PROBES.filter(
    (p) => (!only || p.name === only) && !(live && p.name === 'viewer')
  )) {
    // A profile on disk, as a phone's browser has: an in-memory (incognito)
    // cache won't keep a 14 MB file, so warm loads would refetch it.
    const profile = mkdtempSync(join(tmpdir(), 'dramatis-phone-'))
    const context = await persistentPhone(profile)
    const page = context.pages()[0] ?? (await context.newPage())
    const cold = await measure(page, base, probe, { phone })
    const warm = await measure(page, base, probe, { phone })
    for (const [label, c] of [
      ['cold', cold],
      ['warm', warm],
    ] as const) {
      if (process.argv.includes('--files'))
        for (const [u, b] of c.byUrl.slice(0, 8))
          console.log(`           ${mb(b).padStart(9)}  ${u}`)
      console.log(
        `${probe.name.padEnd(8)} ${label}: FCP ${s(c.fcpMs)}, useful ${s(
          c.usefulMs
        )}, ready ${s(c.readyMs)}, ${mb(
          c.transferBytes
        )} over the wire, heap peak ${mb(c.peakHeapBytes)}`
      )
    }
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
  server?.stop(true)
}
