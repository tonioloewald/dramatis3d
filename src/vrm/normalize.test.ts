// Normalised bones (normalize.ts): the mesh at rest must not move, every joint
// must rest unrotated, and the result must still be a valid VRM that
// three-vrm reads.

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type VRM, VRMLoaderPlugin } from '@pixiv/three-vrm'
import { Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { accessorValues, readGlb } from 'tosijs-3d/glb-chunks'
import { bonesNormalised, normaliseBones, worldMatrices } from './normalize'
import { vrmFromGlb, vrmProblems } from '.'

const OUT = join(import.meta.dir, '..', '..', 'samples', 'out')
const sample = readdirSync(OUT)
  .filter((f) => f.endsWith('.glb'))
  .sort()
  .find((f) => {
    const d = readGlb(new Uint8Array(readFileSync(join(OUT, f)))).json.asset
      .extras.dramatis
    return d.naming === 'ue' && d.restPose === 't-pose'
  })!
const vrm = vrmFromGlb(new Uint8Array(readFileSync(join(OUT, sample))))

/** Each joint's skin matrix at rest: world times inverse bind. */
function skinMatrices(bytes: Uint8Array): number[][] {
  const g = readGlb(bytes)
  const world = worldMatrices(g.json)
  const skin = g.json.skins[0]
  const ibm = accessorValues(g, skin.inverseBindMatrices)
  return (skin.joints as number[]).map((j, k) => {
    const w = world[j]!
    const b = ibm.subarray(k * 16, k * 16 + 16)
    const o: number[] = []
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0
        for (let i = 0; i < 4; i++) s += w[i * 4 + r]! * b[c * 4 + i]!
        o.push(s)
      }
    return o
  })
}

describe('normaliseBones', () => {
  const out = normaliseBones(vrm)

  test('the export is not normalised to start with; the result is', () => {
    expect(bonesNormalised(readGlb(vrm).json)).toBe(false)
    expect(bonesNormalised(readGlb(out).json)).toBe(true)
  })

  test('the mesh at rest does not move: every skin matrix is the same', () => {
    const a = skinMatrices(vrm)
    const b = skinMatrices(out)
    let worst = 0
    a.forEach((m, k) =>
      m.forEach((v, i) => (worst = Math.max(worst, Math.abs(v - b[k]![i]!))))
    )
    expect(worst).toBeLessThan(1e-5)
  })

  test('joints stay where they were', () => {
    const a = worldMatrices(readGlb(vrm).json)
    const b = worldMatrices(readGlb(out).json)
    for (const j of readGlb(vrm).json.skins[0].joints as number[])
      for (const i of [12, 13, 14])
        expect(Math.abs(a[j]![i]! - b[j]![i]!)).toBeLessThan(1e-6)
  })

  test('still a valid VRM, with the look-at origin in the same place', () => {
    expect(vrmProblems(out)).toEqual([])
    const before = readGlb(vrm).json
    const after = readGlb(out).json
    const head = before.extensions.VRMC_vrm.humanoid.humanBones.head.node
    const at = (json: any) => {
      const w = worldMatrices(json)[head]!
      const [x, y, z] = json.extensions.VRMC_vrm.lookAt.offsetFromHeadBone
      return [0, 1, 2].map(
        (r) => w[r]! * x + w[4 + r]! * y + w[8 + r]! * z + w[12 + r]!
      )
    }
    const a = at(before)
    const b = at(after)
    for (let i = 0; i < 3; i++)
      expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(1e-4)
  })

  test('three-vrm poses both the same, and the raw bones of the normalised one are its pose', async () => {
    const a = await loadVrm(vrm)
    const b = await loadVrm(out)
    const pose = (v: VRM) => {
      // Arms down by 60 degrees and the left elbow bent, in VRM's normalised pose.
      v.humanoid
        .getNormalizedBoneNode('leftUpperArm')!
        .rotation.set(0, 0, -1.05)
      v.humanoid
        .getNormalizedBoneNode('rightUpperArm')!
        .rotation.set(0, 0, 1.05)
      v.humanoid.getNormalizedBoneNode('leftLowerArm')!.rotation.set(0, -1, 0)
      v.update(0)
      v.scene.updateMatrixWorld(true)
      return (['leftHand', 'rightHand', 'head'] as const).map((n) =>
        v.humanoid.getRawBoneNode(n)!.getWorldPosition(new Vector3())
      )
    }
    const pa = pose(a)
    const pb = pose(b)
    pa.forEach((p, i) => expect(p.distanceTo(pb[i]!)).toBeLessThan(1e-4))
    // In the normalised file, raw bone = normalised bone: an app that sets the
    // raw bones directly gets the same pose.
    for (const n of ['leftUpperArm', 'leftLowerArm'] as const) {
      const raw = b.humanoid.getRawBoneNode(n)!.quaternion
      const norm = b.humanoid.getNormalizedBoneNode(n)!.quaternion
      expect(Math.abs(raw.dot(norm))).toBeGreaterThan(1 - 1e-6)
    }
  })
})

async function loadVrm(bytes: Uint8Array): Promise<VRM> {
  const g = globalThis as Record<string, unknown>
  if (typeof g.createImageBitmap !== 'function')
    g.createImageBitmap = async () => ({ width: 1, height: 1, close() {} })
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const gltf = await loader.parseAsync(buffer, '')
  const vrm = gltf.userData.vrm as VRM | undefined
  if (vrm === undefined) throw new Error('three-vrm found no VRM')
  return vrm
}
