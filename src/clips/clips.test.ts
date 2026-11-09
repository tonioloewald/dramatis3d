import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readGlbClips } from 'tosijs-3d/glb-clips'
import { UE_JOINT_NAMES } from '../contracts'
import { bakeAnimations, builtSkeleton, ualClips, UAL_CLIPS_LICENCE } from '.'

const ROOT = join(import.meta.dir, '..', '..')
const STARTER = join(ROOT, 'site', 'static', 'clips', 'ual-starter.glb')
const read = async (p: string) =>
  new Uint8Array(await Bun.file(p).arrayBuffer())

describe('clips in the export (#3908)', () => {
  test('ualClips names them, with UAL’s CC0 licence; an unknown one throws', async () => {
    const clips = ualClips(await read(STARTER), ['Walk_Loop'])
    expect(clips[0]!.clip).toBe('Walk_Loop')
    expect(clips[0]!.licence).toBe(UAL_CLIPS_LICENCE)
    expect(UAL_CLIPS_LICENCE.licence).toBe('CC0-1.0')
    expect(() => ualClips(clips[0]!.from, ['Moonwalk'])).toThrow(/no Moonwalk/)
  })

  test('baked onto UAL’s own skeleton, every joint index is a profile joint', async () => {
    // The starter file's skeleton is UAL's: bake onto it as the built one.
    const from = readGlbClips(await read(STARTER))
    const joints = UE_JOINT_NAMES.map((name) => {
      const b = from.bones.find((x) => x.name === name)!
      const parent = b.parent ? UE_JOINT_NAMES.indexOf(b.parent) : -1
      return {
        name,
        parent,
        translation: [b.position.x, b.position.y, b.position.z] as [
          number,
          number,
          number
        ],
        rotation: [b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w] as [
          number,
          number,
          number,
          number
        ],
        position: [0, 0, 0] as [number, number, number],
        inverseBind: new Float32Array(16),
      }
    })
    expect(builtSkeleton(joints).roles.hips).toBe('pelvis')
    const [walk] = bakeAnimations(joints, ualClips(from, ['Walk_Loop']))
    expect(walk!.name).toBe('Walk_Loop')
    expect(walk!.extras).toEqual({
      dramatis: { licence: 'quaternius:animation/ual1' },
    })
    for (const ch of walk!.channels)
      expect(ch.joint).toBeLessThan(UE_JOINT_NAMES.length)
    expect(walk!.channels.some((c) => c.path === 'translation')).toBe(true)
  })
})
