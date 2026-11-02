// Spike 1's engine checks as tests. Two tiers:
//
// - splice-clip: always runs (Bun only): the spliced file is valid glTF and
//   three.js plays the spliced clip on the export's own bones.
// - the engines: Godot, Blender and Babylon on samples/out. They need the
//   apps (Godot, Blender) and take a minute, so they run only with
//   DRAMATIS_ENGINES=1 and are reported NOT RUN otherwise:
//
//     DRAMATIS_ENGINES=1 bun test tools/engines

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AnimationMixer, Bone, SkinnedMesh, Vector3 } from 'three'
import { loadWithThree, validatorErrors } from '../../test/gate1/checks'
import { readGlb } from 'tosijs-3d/glb-chunks'
import { runBabylon } from './babylon'
import { runBlender } from './blender'
import { SAMPLES_OUT, UAL_CLIP } from './common'
import { runGodot } from './godot'
import { spliceClip } from './splice-clip'

const sample = readdirSync(SAMPLES_OUT).find((f) => f.endsWith('-mixamo.glb'))

describe('splice-clip', () => {
  test.skipIf(sample === undefined)(
    'adds UAL Walk_Loop on the export joints; valid, and three.js plays it',
    async () => {
      const bytes = spliceClip(
        new Uint8Array(readFileSync(join(SAMPLES_OUT, sample!))),
        new Uint8Array(readFileSync(UAL_CLIP))
      )
      expect(await validatorErrors(bytes)).toEqual([])
      const json = readGlb(bytes).json
      const anim = json.animations.at(-1)
      // Rotations on joints, translations only on root and the pelvis.
      const moved = anim.channels
        .filter(
          (c: { target: { path: string } }) => c.target.path === 'translation'
        )
        .map(
          (c: { target: { node: number } }) => json.nodes[c.target.node].name
        )
      expect(moved.sort()).toEqual(['mixamorig:Hips', 'root'])
      const gltf = await loadWithThree(bytes)
      const clip = gltf.animations[0]!
      let hand: Bone | undefined
      gltf.scene.traverse((o) => {
        if (o instanceof SkinnedMesh)
          hand ??= o.skeleton.bones.find((b) => b.name === 'mixamorigLeftHand')
      })
      expect(hand).toBeDefined()
      gltf.scene.updateMatrixWorld(true)
      const rest = hand!.getWorldPosition(new Vector3())
      const mixer = new AnimationMixer(gltf.scene)
      mixer.clipAction(clip).play()
      mixer.setTime(clip.duration / 2)
      gltf.scene.updateMatrixWorld(true)
      expect(
        hand!.getWorldPosition(new Vector3()).distanceTo(rest)
      ).toBeGreaterThan(0.1)
    },
    60_000
  )
})

const ON = process.env.DRAMATIS_ENGINES === '1'
const engineTest = (name: string, fn: () => Promise<void>) =>
  ON
    ? test(name, fn, 600_000)
    : test.skip(`NOT RUN (set DRAMATIS_ENGINES=1): ${name}`, fn)

const failures = (
  cs: Array<{
    file: string
    checks: Array<{ check: string; ok: boolean; evidence: string[] }>
  }>
) =>
  cs.flatMap((c) =>
    c.checks
      .filter((k) => !k.ok)
      .map((k) => `${c.file} ${k.check}: ${k.evidence.join(' | ')}`)
  )

describe('engines (spike 1)', () => {
  engineTest('Godot imports every export and plays UAL Walk_Loop', async () => {
    const r = await runGodot()
    expect(r.error).toBeUndefined()
    expect(r.characters.length).toBeGreaterThan(0)
    expect(failures(r.characters)).toEqual([])
  })
  engineTest(
    'Blender imports every export (armature, weights, shape keys, clip)',
    async () => {
      const r = await runBlender()
      expect(r.error).toBeUndefined()
      expect(failures(r.characters)).toEqual([])
    }
  )
  engineTest('Babylon loads every export and plays UAL Walk_Loop', async () => {
    const r = await runBabylon()
    expect(r.ran).toBe(true)
    expect(failures(r.characters)).toEqual([])
  })
})
