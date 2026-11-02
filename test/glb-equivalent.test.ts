import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readGlb, writeGlb } from 'tosijs-3d/glb-chunks'
import { glbDifferences } from './glb-equivalent'

// The network tier's "samples/out/<name>.glb is what its character file builds today" uses
// glbDifferences, because byte identity fails across platforms (see glb-equivalent.ts).
// These tests pin that it still catches a real change.
const sample = async (): Promise<Uint8Array> =>
  new Uint8Array(
    await Bun.file(
      join(import.meta.dir, '..', 'samples', 'out', 'clothed-casual.glb')
    ).arrayBuffer()
  )

/** Re-encode the sample after nudging the first POSITION component by `delta`. */
async function nudged(delta: number): Promise<Uint8Array> {
  const glb = readGlb(await sample())
  const json = structuredClone(glb.json)
  const bin = glb.bin!.slice()
  const position = json.meshes[0].primitives[0].attributes.POSITION
  const accessor = json.accessors[position]
  const view = json.bufferViews[accessor.bufferView]
  const dv = new DataView(bin.buffer)
  const at = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  dv.setFloat32(at, dv.getFloat32(at, true) + delta, true)
  // Mimic the platform drift: the JSON's printed bounds change length too.
  accessor.max[0] = accessor.max[0] + delta / 10
  return writeGlb(json, bin)
}

describe('glbDifferences', () => {
  test('an export is equivalent to itself', async () => {
    const bytes = await sample()
    expect(glbDifferences(bytes, bytes)).toEqual([])
  })

  test('float drift far below a tenth of a millimetre passes, though the bytes differ', async () => {
    const a = await sample()
    const b = await nudged(1e-7)
    expect(Buffer.compare(a, b)).not.toBe(0)
    expect(glbDifferences(a, b)).toEqual([])
  })

  test('a vertex moved by a millimetre is a difference', async () => {
    const out = glbDifferences(await sample(), await nudged(1e-3))
    expect(out.length).toBeGreaterThan(0)
  })

  test('a changed image byte is a difference', async () => {
    const glb = readGlb(await sample())
    const image = glb.json.images?.find(
      (i: { bufferView?: number }) => i.bufferView !== undefined
    )
    expect(image).toBeDefined()
    const bin = glb.bin!.slice()
    const view = glb.json.bufferViews[image.bufferView]
    const at = (view.byteOffset ?? 0) + 100
    bin[at] = bin[at]! ^ 0xff
    expect(
      glbDifferences(await sample(), writeGlb(glb.json, bin))
    ).toContainEqual(expect.stringContaining('bytes differ'))
  })
})
