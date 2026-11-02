import type { BunPlugin } from 'bun'
import { describe, expect, test } from 'bun:test'
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

/*
NO BABYLON IN THE ENGINE-FREE ENTRIES, pinned.

`dramatis/three` is for three.js users, and `dramatis` (the core) is for any
engine. A three.js bundle with Babylon in it is a failed build (CLAUDE.md), and
so is a `.d.ts` that needs Babylon installed to type-check: that one is erased
from the bundle, so the bundle check alone never sees it (PLAN.md records
exactly that leak in tosijs-3d's `rigged-body`, fixed in 0.12.0).

Three checks per entry:

1. BUNDLE. `Bun.build` for the browser; fail if any import specifier names
   `@babylonjs` or the output mentions it. `three` stays external (it is the
   consumer's peer); everything else, tosijs-3d included, is bundled.
2. EMITTED TYPES. `tsc --emitDeclarationOnly` on the entry; fail if any emitted
   `.d.ts` mentions `@babylonjs`.
3. TYPE CLOSURE. The same tsc program's file list; fail if any file under
   `@babylonjs` is in it. This catches a type we re-export from a dependency
   whose own declarations import Babylon.

Each check is shown able to fail, on fixtures in `test/fixtures/`.

Until tosijs-3d's stage A pins its pure core with a check of its own, this is
the only thing standing between a tosijs-3d release and a Babylon-laden embed.
*/

const ROOT = join(import.meta.dir, '..')
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc')

const ENTRIES = {
  'dramatis (core)': 'src/index.ts',
  'dramatis/three': 'src/three/index.ts',
}

const BABYLON = /@babylonjs/

interface BundleResult {
  ok: boolean
  logs: string
  /** import specifiers that named Babylon */
  specifiers: string[]
  /** output files whose text mentions Babylon */
  outputs: string[]
  /** the whole bundle, for positive controls */
  text: string
}

/** Records every import specifier naming Babylon, then lets resolution proceed. */
function recordBabylonImports(into: string[]): BunPlugin {
  return {
    name: 'record-babylon-imports',
    setup(build) {
      build.onResolve({ filter: BABYLON }, (args) => {
        into.push(`${args.path} (from ${relative(ROOT, args.importer)})`)
        return undefined
      })
    },
  }
}

async function bundle(entry: string): Promise<BundleResult> {
  const specifiers: string[] = []
  const result = await Bun.build({
    entrypoints: [join(ROOT, entry)],
    target: 'browser',
    external: ['three'],
    minify: false,
    plugins: [recordBabylonImports(specifiers)],
  })
  const outputs: string[] = []
  let text = ''
  for (const output of result.outputs) {
    const body = await output.text()
    text += body
    if (BABYLON.test(body)) outputs.push(output.path)
  }
  return {
    ok: result.success,
    logs: result.logs.map(String).join('\n'),
    specifiers,
    outputs,
    text,
  }
}

interface TypesResult {
  exitCode: number
  stdout: string
  /** emitted .d.ts files that mention Babylon */
  declarations: string[]
  /** files under @babylonjs in the type program */
  closure: string[]
}

function types(entry: string): TypesResult {
  const dir = mkdtempSync(join(tmpdir(), 'dramatis-no-babylon-'))
  try {
    const out = join(dir, 'out')
    const config = join(dir, 'tsconfig.json')
    writeFileSync(
      config,
      JSON.stringify({
        extends: join(ROOT, 'tsconfig.json'),
        compilerOptions: {
          noEmit: false,
          declaration: true,
          emitDeclarationOnly: true,
          rootDir: ROOT,
          outDir: out,
          // A consumer's program: no Bun globals, nothing ambient.
          types: [],
        },
        files: [join(ROOT, entry)],
      })
    )
    const proc = Bun.spawnSync([TSC, '-p', config, '--listFiles'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout =
      new TextDecoder().decode(proc.stdout) +
      new TextDecoder().decode(proc.stderr)
    const closure = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /[/\\]@babylonjs[/\\]/.test(line))
      .map((line) => relative(ROOT, line))
    const declarations: string[] = []
    const walk = (d: string): void => {
      let names: string[]
      try {
        names = readdirSync(d)
      } catch {
        return
      }
      for (const name of names) {
        const path = join(d, name)
        if (name.endsWith('.d.ts')) {
          if (BABYLON.test(readFileSync(path, 'utf8')))
            declarations.push(relative(out, path))
        } else if (!name.includes('.')) walk(path)
      }
    }
    walk(out)
    return { exitCode: proc.exitCode ?? -1, stdout, declarations, closure }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('the engine-free entries never reach Babylon', () => {
  for (const [name, entry] of Object.entries(ENTRIES)) {
    test(`${name}: the browser bundle has no Babylon`, async () => {
      const r = await bundle(entry)
      expect(r.logs).toBe('')
      expect(r.ok).toBe(true)
      expect(r.specifiers).toEqual([])
      expect(r.outputs).toEqual([])
    })

    test(`${name}: emitted declarations and their type closure have no Babylon`, () => {
      const r = types(entry)
      // A type error would leave the emitted .d.ts unreliable: fail on it here.
      expect(r.exitCode === 0 ? '' : r.stdout).toBe('')
      expect(r.declarations).toEqual([])
      expect(r.closure).toEqual([])
    }, 60_000)
  }

  test('the three.js bundle really contains the tosijs-3d body maths', async () => {
    // Positive control: a bundle that silently dropped tosijs-3d would also
    // contain no Babylon. Unminified, the function names survive.
    const r = await bundle(ENTRIES['dramatis/three'])
    expect(r.text).toContain('function macroWeights')
    expect(r.text).toContain('function morphHuman')
  })
})

describe('the guard can fail', () => {
  test('a runtime Babylon import is caught in the bundle', async () => {
    const r = await bundle('test/fixtures/babylon-leak.ts')
    expect(r.specifiers.length).toBeGreaterThan(0)
    expect(r.outputs.length).toBeGreaterThan(0)
  })

  test('a type-only Babylon import passes the bundle but is caught in the declarations', async () => {
    const b = await bundle('test/fixtures/babylon-type-leak.ts')
    expect(b.specifiers).toEqual([])
    expect(b.outputs).toEqual([])
    const t = types('test/fixtures/babylon-type-leak.ts')
    expect(t.declarations.length).toBeGreaterThan(0)
    expect(t.closure.length).toBeGreaterThan(0)
  }, 60_000)

  test("a dependency's Babylon-typed declarations are caught in the type closure", () => {
    const t = types('test/fixtures/babylon-transitive-type-leak.ts')
    // Our own emitted .d.ts only names the dependency...
    expect(t.declarations).toEqual([])
    // ...but its .d.ts imports Material from Babylon.
    expect(t.closure.length).toBeGreaterThan(0)
  }, 60_000)
})
