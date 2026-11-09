// SIZE CEILINGS for the library's entries (#3670): what an adopter's bundle
// pays, minified, `three` external, gzip -9 (as samples/three/measure-bundle.ts
// measures it). Lower a ceiling when an entry shrinks; never raise one without
// saying why here.
//
// History (gzip): dramatis/three 5.3 KiB at 0.1.0, 5.2 KiB 2026-11-03;
// dramatis 43.4 KiB 2026-11-03 (4.6 KiB less once the GLB writer moved to
// tosijs-3d's subpaths); 45.4 KiB at tosijs-3d 0.12.3; 62.2 KiB 2026-11-07,
// raised to 66 for mesh bodies (#3856: tosijs-3d's GLB reader, rig fit, bone
// heat and rigged-body writer, about 17 KiB). Loading them on demand saved
// only about 7 KiB once split, as the chunks share most of the writer.
// 69.5 KiB at tosijs-3d 0.12.5 (2026-11-09), raised to 72: its rigged-body
// writer now writes garments, clips and held items (#3882-#3884), about
// 7 KiB, with nothing changed here. 72.5 KiB 2026-11-09 with clips in the
// export (#3908: glb-clips' reader and baker, src/clips/), raised to 76.

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const KiB = 1024

const CEILINGS: Record<string, number> = {
  'src/three/index.ts': 7 * KiB,
  'src/index.ts': 76 * KiB,
}

async function gzipSize(entry: string): Promise<number> {
  const r = await Bun.build({
    entrypoints: [join(ROOT, entry)],
    target: 'browser',
    external: ['three'],
    minify: true,
  })
  if (!r.success) throw new Error(r.logs.join('\n'))
  let gz = 0
  for (const o of r.outputs)
    gz += Bun.gzipSync(new Uint8Array(await o.arrayBuffer()), {
      level: 9,
    }).byteLength
  return gz
}

describe('library size ceilings (gzip)', () => {
  for (const [entry, ceiling] of Object.entries(CEILINGS))
    test(`${entry} stays under ${ceiling / KiB} KiB`, async () => {
      expect(await gzipSize(entry)).toBeLessThan(ceiling)
    }, 30_000)
})
