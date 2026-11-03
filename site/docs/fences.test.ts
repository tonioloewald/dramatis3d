// The docs' TypeScript fences typecheck against the library as it is (#3676).
// A page's ```ts fences become one module, `dramatis` and `dramatis/three`
// mapped to src/, and tsc --noEmit checks every page: the page's imports,
// merged, at the top (a reader carries a fence's imports to the next), and
// each fence's body in a block of its own (so two fences may each declare
// their own `pack`). Errors are reported at their line in the page. The
// fences are fragments: the names a page introduces in prose (the scene, a
// character, a loaded pack) are declared once, in PRELUDE, with their real
// types where Dramatis has them. A name not there is an error, as it should
// be: a typo or a renamed export fails the test.
//
// Display-only fences (```typescript, ```json, ```sh) are left alone.

import { describe, expect, test } from 'bun:test'
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const DOCS = import.meta.dir
const OUT = join(ROOT, '.cache', 'doc-fences')

/** An import: `import { a, b as c } from 'x'`, or any other form (whole). */
const IMPORT = /^import\s+(?:\{([^}]*)\}\s+from\s+'([^']+)'|[^\n]*)$/gm

const PRELUDE = `
import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack } from 'tosijs-3d/human-pack'
import type { AnimationClip } from 'three'
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { AbstractMesh, Skeleton } from '@babylonjs/core'
import type { CharacterObject } from 'dramatis/three'
declare global {
  /** A three.js or Babylon scene: the page's own. */
  const scene: any
  /** A character file's text. */
  const json: string
  const character: Character
  const changed: Character
  const pack: HumanPack
  /** dramatis/three's characterObject(...), made earlier on the page. */
  const c: CharacterObject
  /** A UAL clip, loaded earlier on the page. */
  const walk: AnimationClip
  const hipHeightRatio: number
  /** A GLTFLoader, made earlier on the page. */
  const loader: GLTFLoader
  /** A loaded GLB (three.js), from the page's first fence. */
  const gltf: GLTF
  /** What Babylon's ImportMeshAsync gave, from the page's first fence. */
  const meshes: AbstractMesh[]
  const skeleton: Skeleton
}
export {}
`

/** Every ```ts fence, with where it came from. */
export function tsFences(): { page: string; line: number; code: string }[] {
  const out: { page: string; line: number; code: string }[] = []
  for (const page of readdirSync(DOCS).filter((f) => f.endsWith('.md'))) {
    const lines = readFileSync(join(DOCS, page), 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!/^```ts\b/.test(lines[i]!)) continue
      const start = i + 1
      let end = start
      while (end < lines.length && !lines[end]!.startsWith('```')) end++
      out.push({
        page,
        line: start + 1,
        code: lines.slice(start, end).join('\n'),
      })
      i = end
    }
  }
  return out
}

describe('docs code fences', () => {
  test('every ```ts fence in site/docs typechecks against src/', () => {
    const fences = tsFences()
    expect(fences.length).toBeGreaterThan(10)
    rmSync(OUT, { recursive: true, force: true })
    mkdirSync(OUT, { recursive: true })
    writeFileSync(join(OUT, 'prelude.d.ts'), PRELUDE)
    // One module per page; `lines` maps each module line to the page's.
    const lines = new Map<string, number[]>()
    const files = [...new Set(fences.map((f) => f.page))].map((page) => {
      const head: [string, number][] = []
      const body: [string, number][] = []
      const named = new Map<string, Set<string>>()
      for (const f of fences.filter((x) => x.page === page)) {
        let code = f.code
        for (const m of f.code.matchAll(IMPORT)) {
          const at = f.line + f.code.slice(0, m.index).split('\n').length - 1
          const [, names, from] = m
          if (names && from) {
            const seen = named.get(from) ?? new Set<string>()
            named.set(from, seen)
            const fresh = names
              .split(',')
              .map((n) => n.trim())
              .filter((n) => n && !seen.has(n))
            fresh.forEach((n) => seen.add(n))
            if (fresh.length)
              head.push([`import { ${fresh.join(', ')} } from '${from}'`, at])
          } else head.push([m[0].replace(/\s+/g, ' '), at])
          // Blank the import, keeping its lines, so the body's lines map.
          code = code.replace(m[0], m[0].replace(/[^\n]/g, ''))
        }
        body.push(['{', f.line - 1])
        code.split('\n').forEach((l, i) => body.push([l, f.line + i]))
        body.push(['}', f.line - 1])
      }
      const all = [...head, ...body]
      lines.set(
        page,
        all.map(([, at]) => at)
      )
      const name = `${page.replace(/\.md$/, '')}.ts`
      writeFileSync(
        join(OUT, name),
        `${all.map(([l]) => l).join('\n')}\nexport {}\n`
      )
      return name
    })
    writeFileSync(
      join(OUT, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: [],
          lib: ['ES2022', 'DOM'],
          baseUrl: ROOT,
          typeRoots: [join(ROOT, 'node_modules', '@types')],
          paths: {
            dramatis: ['src/index.ts'],
            'dramatis/three': ['src/three/index.ts'],
          },
        },
        files: ['prelude.d.ts', ...files],
      })
    )
    const tsc = Bun.spawnSync(
      [
        join(ROOT, 'node_modules', '.bin', 'tsc'),
        '-p',
        join(OUT, 'tsconfig.json'),
      ],
      { cwd: ROOT }
    )
    const errors = tsc.stdout
      .toString()
      .split('\n')
      .filter((l) => /error TS/.test(l))
      // Name each error by its page and line in the doc, not the temp file.
      .map((l) =>
        l.replace(
          /^.*?([a-z0-9-]+)\.ts\((\d+),\d+\)/,
          (_, page, row) =>
            `site/docs/${page}.md:${
              lines.get(`${page}.md`)?.[Number(row) - 1] ?? `?${row}`
            }`
        )
      )
    expect(errors).toEqual([])
  }, 60_000)
})
