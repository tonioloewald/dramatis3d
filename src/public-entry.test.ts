import { describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { cachedFetch } from './build/cdn'
import {
  BUILD_SETTINGS,
  HM08_PACK_URL,
  readCharacter,
  writeCharacter,
  type Character,
} from '.'

/*
THE CORE'S HEADLINE FLOW RUNS FROM THE DOCS, pinned.

`readCharacter` keeps only the settings keys it is given, so a reader needs
the whole default set, and a builder needs the pack's URL. Both come from the
public entry (reviews/0.1.0-pre-minor.md, the docs major). The `ts` fences in
site/docs/export.md and site/docs/dramatis-core.md are type-checked against
the public entry here (offline), and run for real on the network tier:

  DRAMATIS_NETWORK=1 bun test src/public-entry.test.ts
*/

const ROOT = join(import.meta.dir, '..')
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc')
// Inside the repo (git-ignored) so the fences resolve tosijs-3d as a consumer does.
const DIR = join(ROOT, '.cache', 'doc-fences')

/** The docs whose fences import 'dramatis', and what each fence ends with. */
const PAGES: Record<string, string[]> = {
  'export.md': ['glb'],
  'dramatis-core.md': ['glb', 'vrm'],
}

/** The first `ts` fence on a page that imports from 'dramatis'. */
function fence(page: string): string {
  const text = readFileSync(join(ROOT, 'site', 'docs', page), 'utf8')
  const found = [...text.matchAll(/```ts\n([\s\S]*?)```/g)]
    .map((m) => m[1]!)
    .find((code) => /from 'dramatis'/.test(code))
  if (found == null) throw new Error(`${page}: no ts fence imports 'dramatis'`)
  return found
}

/** A fence as a module of its own, importing the checkout's entry. */
function fenceModule(page: string, preamble: string, tail = ''): string {
  mkdirSync(DIR, { recursive: true })
  const entry = relative(DIR, join(ROOT, 'src', 'index.ts'))
  const code = fence(page).replace(/from 'dramatis'/g, `from '${entry}'`)
  const path = join(DIR, page.replace(/\.md$/, '.ts'))
  writeFileSync(path, `${preamble}\n${code}\n${tail}\n`)
  return path
}

describe('the public entry gives what reading a character needs', () => {
  test('BUILD_SETTINGS and HM08_PACK_URL are exported', () => {
    expect(Object.keys(BUILD_SETTINGS).length).toBeGreaterThan(20)
    expect(HM08_PACK_URL).toMatch(/^https:\/\/.*hm08\.json/)
  })

  test('readCharacter(json, { settings: BUILD_SETTINGS }) keeps every key', () => {
    // Every setting moved off its default, keeping its type.
    const settings: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(BUILD_SETTINGS))
      settings[key] =
        typeof value === 'number' ? (value === 0.25 ? 0.75 : 0.25) : value
    const character: Character = {
      name: 'every key',
      settings,
      cloth: {},
      tailor: [],
      garments: {},
    }
    const json = JSON.stringify(writeCharacter(character))
    const read = readCharacter(json, { settings: BUILD_SETTINGS })
    expect(read.warnings).toEqual([])
    expect(read.character.settings).toEqual(settings)
  })
})

describe('the docs fences', () => {
  test('type-check against the public entry', () => {
    const files = Object.keys(PAGES).map((page) =>
      fenceModule(page, 'declare const json: string')
    )
    const config = join(DIR, 'tsconfig.json')
    writeFileSync(
      config,
      JSON.stringify({ extends: join(ROOT, 'tsconfig.json'), files })
    )
    const proc = Bun.spawnSync([TSC, '-p', config], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out =
      new TextDecoder().decode(proc.stdout) +
      new TextDecoder().decode(proc.stderr)
    expect(out).toBe('')
    expect(proc.exitCode).toBe(0)
  }, 60_000)

  const ON = process.env.DRAMATIS_NETWORK === '1'
  for (const [page, names] of Object.entries(PAGES)) {
    const name = `${page}'s fence runs and makes a glTF binary`
    const run = async (): Promise<void> => {
      const sample = join(
        ROOT,
        'samples',
        'out',
        'clothed-casual.character.json'
      )
      // The fences call the global fetch; this one keeps the pack on disk.
      // cachedFetch itself calls the global fetch on a miss: that call (its
      // URL already in flight) goes to the real one.
      const cached = cachedFetch()
      const real = globalThis.fetch
      const inFlight = new Set<string>()
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input)
        if (inFlight.has(url)) return real(url)
        inFlight.add(url)
        try {
          return new Response(await cached(url))
        } finally {
          inFlight.delete(url)
        }
      }) as typeof fetch
      try {
        const path = fenceModule(
          page,
          `const json = await Bun.file(${JSON.stringify(sample)}).text()`,
          `export { ${names.join(', ')} }`
        )
        const made = (await import(path)) as Record<string, Uint8Array>
        for (const n of names) {
          const bytes = made[n]!
          expect(bytes).toBeInstanceOf(Uint8Array)
          expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('glTF')
        }
      } finally {
        globalThis.fetch = real
        rmSync(join(DIR, page.replace(/\.md$/, '.ts')), { force: true })
      }
    }
    if (ON) test(name, run, 300_000)
    else test.skip(`NOT RUN (set DRAMATIS_NETWORK=1): ${name}`, run)
  }
})
