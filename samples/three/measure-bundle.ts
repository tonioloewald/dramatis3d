// Spike 4's bundle measurement (reports/spike-4.md): what the three.js entry
// adds to a browser bundle. Run: bun samples/three/measure-bundle.ts
//
// Each case is Bun.build for the browser, minified, one ES module output,
// measured raw and gzip-9 (Bun.gzipSync). `three` is external unless the case
// says it is bundled, because it is the adopter's peer and they pay for it
// anyway.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
// Inside the repo, so `three` resolves from its node_modules; removed after.
const dir = mkdtempSync(join(import.meta.dir, '.measure-'))

interface Case {
  name: string
  source: string
  bundleThree: boolean
}

const src = (p: string): string => JSON.stringify(join(ROOT, p))

const cases: Case[] = [
  {
    name: 'dramatis/three, whole entry (import *), three external',
    source: `import * as d from ${src('src/three/index.ts')}; console.log(d)`,
    bundleThree: false,
  },
  {
    name: 'characterObject + updateCharacterObject + characterClip, three external',
    source: `import { characterObject, updateCharacterObject, characterClip } from ${src(
      'src/three/index.ts'
    )}; console.log(characterObject, updateCharacterObject, characterClip)`,
    bundleThree: false,
  },
  {
    name: 'morphedBodyGeometry only (tosijs-3d body maths), three external',
    source: `import { morphedBodyGeometry } from ${src(
      'src/three/index.ts'
    )}; console.log(morphedBodyGeometry)`,
    bundleThree: false,
  },
  {
    name: 'baseline: three alone (the same imports the adapter uses), bundled',
    source: `import { Bone, BufferAttribute, BufferGeometry, Color, Group, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, PropertyBinding, Skeleton, SkinnedMesh, Texture, AnimationClip, VectorKeyframeTrack } from 'three'; console.log(Bone, BufferAttribute, BufferGeometry, Color, Group, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, PropertyBinding, Skeleton, SkinnedMesh, Texture, AnimationClip, VectorKeyframeTrack)`,
    bundleThree: true,
  },
  {
    name: 'dramatis/three whole entry with three bundled',
    source: `import * as d from ${src('src/three/index.ts')}; console.log(d)`,
    bundleThree: true,
  },
]

const kb = (n: number): string => `${(n / 1024).toFixed(1)} KiB`

console.log('| case | minified | gzip | Babylon in output |')
console.log('| --- | ---: | ---: | --- |')
try {
  for (const [i, c] of cases.entries()) {
    const entry = join(dir, `case${i}.ts`)
    writeFileSync(entry, c.source)
    const result = await Bun.build({
      entrypoints: [entry],
      target: 'browser',
      format: 'esm',
      minify: true,
      external: c.bundleThree ? [] : ['three'],
    })
    if (!result.success) throw new Error(result.logs.map(String).join('\n'))
    let text = ''
    for (const o of result.outputs) text += await o.text()
    const raw = new TextEncoder().encode(text)
    const gz = Bun.gzipSync(raw, { level: 9 })
    console.log(
      `| ${c.name} | ${kb(raw.byteLength)} | ${kb(gz.byteLength)} | ${
        /@babylonjs|babylonjs/i.test(text) ? 'YES' : 'no'
      } |`
    )
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
