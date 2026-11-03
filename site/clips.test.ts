// The starter clips file is what site/clips.ts says: exactly the clips the
// creator and the demo play, CC0 credited, a valid glTF, under its budget.

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readGlb } from 'tosijs-3d/glb-chunks'
import { validatorErrors } from '../test/gate1/checks'
import { CREATOR_CLIPS, STARTER_CLIPS } from './clips'
import { GAITS } from './demo/core'

const FILE = join(import.meta.dir, 'static', 'clips', 'ual-starter.glb')
const bytes = new Uint8Array(await Bun.file(FILE).arrayBuffer())

describe('the starter clips', () => {
  test('hold the creator’s clips and the demo’s gaits, and nothing else', () => {
    const glb = readGlb(bytes)
    const names = glb.json.animations.map((a: { name: string }) => a.name)
    expect(names).toEqual([...STARTER_CLIPS])
    for (const c of CREATOR_CLIPS) expect(names).toContain(c)
    for (const g of GAITS) expect(names).toContain(g.clip)
    // The mannequin and its skin stay: the creator reads its skeleton.
    expect(glb.json.skins?.length).toBe(1)
    expect(glb.json.asset.copyright).toContain('CC0')
  })

  test('are a valid glTF', async () => {
    expect(await validatorErrors(bytes)).toEqual([])
  })

  test('stay under 2 MB (UAL1_core.glb is 6.3 MB)', () => {
    expect(bytes.byteLength).toBeLessThan(2 * 2 ** 20)
  })
})
