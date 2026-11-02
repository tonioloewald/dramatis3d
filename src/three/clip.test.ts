import { describe, expect, test } from 'bun:test'
import {
  AnimationClip,
  Bone,
  Group,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'
import { clipOnExport } from '../../test/gate1/checks'
import { characterClip } from './clip'

/** A UAL-shaped clip: hip translations, a limb's rotation, and keys to drop. */
function ualClip(): AnimationClip {
  return new AnimationClip('Walk', 1, [
    new VectorKeyframeTrack('pelvis.position', [0, 1], [0, 1, 0, 0.5, 2, -1]),
    new VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 0, 0, 3]),
    new VectorKeyframeTrack('spine_01.position', [0, 1], [0, 1, 0, 0, 1, 0]),
    new VectorKeyframeTrack('pelvis.scale', [0, 1], [1, 1, 1, 2, 2, 2]),
    new QuaternionKeyframeTrack(
      'thigh_l.quaternion',
      [0, 1],
      [0, 0, 0, 1, 0, 0.6, 0, 0.8]
    ),
    new QuaternionKeyframeTrack(
      'tail.quaternion',
      [0, 1],
      [0, 0, 0, 1, 0, 0, 0, 1]
    ),
  ])
}

const values = (clip: AnimationClip, name: string): number[] =>
  Array.from(clip.tracks.find((t) => t.name === name)!.values)

describe('characterClip', () => {
  test('keeps rotations everywhere and translations on root and pelvis only', () => {
    const clip = characterClip(ualClip())
    expect(clip.tracks.map((t) => t.name).sort()).toEqual([
      'pelvis.position',
      'root.position',
      'thigh_l.quaternion',
    ])
  })

  test('translationScale multiplies the root and pelvis translations, nothing else', () => {
    const source = ualClip()
    const clip = characterClip(source, { translationScale: 0.5 })
    expect(values(clip, 'pelvis.position')).toEqual([0, 0.5, 0, 0.25, 1, -0.5])
    expect(values(clip, 'root.position')).toEqual([0, 0, 0, 0, 0, 1.5])
    // Rotations are angles: a scale does not touch them.
    expect(values(clip, 'thigh_l.quaternion')).toEqual(
      values(source, 'thigh_l.quaternion')
    )
    // The source clip is left as it was.
    expect(values(source, 'pelvis.position')).toEqual([0, 1, 0, 0.5, 2, -1])
  })

  test('the default scale is 1, and naming renames the scaled tracks', () => {
    expect(values(characterClip(ualClip()), 'pelvis.position')).toEqual([
      0, 1, 0, 0.5, 2, -1,
    ])
    const mixamo = characterClip(ualClip(), {
      naming: 'mixamo',
      translationScale: 2,
    })
    expect(values(mixamo, 'mixamorigHips.position')).toEqual([
      0, 2, 0, 1, 4, -2,
    ])
  })
})

describe("gate 1's clip goes through characterClip", () => {
  /** A scene whose pelvis bone stands `height` above the floor. */
  const hips = (name: string, height: number): Group => {
    const g = new Group()
    const b = new Bone()
    b.name = name
    b.position.set(0, height, 0)
    g.add(b)
    return g
  }

  test('scaled by the hips’ rest height over the clip skeleton’s', () => {
    const clip = clipOnExport(
      ualClip(),
      hips('pelvis', 0.75),
      hips('pelvis', 1),
      'ue'
    )
    expect(values(clip, 'pelvis.position')).toEqual([
      0, 0.75, 0, 0.375, 1.5, -0.75,
    ])
    expect(clip.tracks.some((t) => t.name === 'spine_01.position')).toBe(false)
  })

  test('under Mixamo naming the export’s hips are found by their own name', () => {
    const clip = clipOnExport(
      ualClip(),
      hips('mixamorigHips', 2),
      hips('pelvis', 1),
      'mixamo'
    )
    expect(values(clip, 'mixamorigHips.position')).toEqual([0, 2, 0, 1, 4, -2])
  })
})
