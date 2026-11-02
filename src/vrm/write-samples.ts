// Writes reports/spike-3-vrm/<name>.vrm from the committed sample GLBs in
// samples/out/ (the ue, T-pose ones), for trying in a VRM viewer or a
// VTuber app by hand. Offline: a VRM is its GLB plus VRMC_vrm.
//
//   bun src/vrm/write-samples.ts [name ...]     (default: long-hair)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { vrmFromGlb } from './vrm'

const ROOT = join(import.meta.dir, '..', '..')
const OUT = join(ROOT, 'reports', 'spike-3-vrm')

if (import.meta.main) {
  const names = process.argv.slice(2)
  mkdirSync(OUT, { recursive: true })
  for (const name of names.length > 0 ? names : ['long-hair']) {
    const glb = new Uint8Array(
      readFileSync(join(ROOT, 'samples', 'out', `${name}.glb`))
    )
    const vrm = vrmFromGlb(glb)
    writeFileSync(join(OUT, `${name}.vrm`), vrm)
    console.log(`${name}.vrm: ${(vrm.byteLength / 1e6).toFixed(2)} MB`)
  }
}
