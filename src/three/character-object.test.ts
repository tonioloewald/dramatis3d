import { describe, expect, test } from 'bun:test'
import {
  AnimationMixer,
  Bone,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PropertyBinding,
  SkinnedMesh,
  Vector3,
  type AnimationClip,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BuiltCharacter } from '../contracts/built-character'
import { writeCharacterGlb } from '../contracts/export'
import { jointName, MAJOR_JOINTS, UE_JOINTS } from '../contracts/profile'
import { fixtureCharacter, ualRest } from './fixture-character'
import { characterClip, characterObject, updateCharacterObject } from './index'

const UAL = new URL('../../test/gate1/fixtures/ual-walk.glb', import.meta.url)
  .pathname
const ualBytes = new Uint8Array(await Bun.file(UAL).arrayBuffer())
const rest = ualRest(ualBytes)

async function walkClip(): Promise<AnimationClip> {
  const gltf = await new GLTFLoader().parseAsync(
    ualBytes.buffer.slice(
      ualBytes.byteOffset,
      ualBytes.byteOffset + ualBytes.byteLength
    ) as ArrayBuffer,
    ''
  )
  const clip = gltf.animations.find((a) => a.name === 'Walk_Loop')
  if (clip === undefined) throw new Error('no Walk_Loop')
  return clip
}

/** Where a mesh's vertex is drawn, skinning and morphs applied. */
function drawn(mesh: SkinnedMesh, v: number): Vector3 {
  mesh.updateMatrixWorld(true)
  mesh.skeleton.update()
  return mesh.getVertexPosition(v, new Vector3())
}

describe('characterObject', () => {
  const built = fixtureCharacter(rest)

  test('the skeleton is the profile: 65 bones, names, order, parents', () => {
    const c = characterObject(built)
    expect(c.skeleton.bones.length).toBe(65)
    c.skeleton.bones.forEach((bone, i) => {
      const row = UE_JOINTS[i]!
      expect(bone.name).toBe(row.name)
      if (row.parent === null) expect(bone.parent).toBe(c.root)
      else expect((bone.parent as Bone).name).toBe(row.parent)
    })
    // Top nodes: the root bone, then the meshes (export-format.md).
    expect(c.root.children.map((o) => o.name)).toEqual(['root', 'body', 'eyes'])
  })

  test('mixamo naming, sanitised as GLTFLoader and PropertyBinding have it', () => {
    const c = characterObject(built, { naming: 'mixamo' })
    const hips =
      c.skeleton.bones[UE_JOINTS.findIndex((j) => j.name === 'pelvis')]!
    expect(hips.name).toBe(
      PropertyBinding.sanitizeNodeName(jointName('pelvis', 'mixamo'))
    )
    expect(hips.name).not.toContain(':')
  })

  test('at rest, bones sit at the built positions and skinning is identity', () => {
    const c = characterObject(built)
    c.root.updateMatrixWorld(true)
    const p = new Vector3()
    c.skeleton.bones.forEach((bone, i) => {
      bone.getWorldPosition(p)
      const want = built.skeleton.joints[i]!.position
      expect(p.distanceTo(new Vector3(...want))).toBeLessThan(1e-5)
    })
    const body = c.meshes[0]!
    for (const v of [
      0,
      17,
      100,
      body.geometry.getAttribute('position').count - 1,
    ]) {
      const want = new Vector3().fromArray(built.meshes[0]!.positions, v * 3)
      expect(drawn(body, v).distanceTo(want)).toBeLessThan(1e-5)
    }
  })

  test('meshes, morph names and setFaceUnit', () => {
    const c = characterObject(built)
    expect(c.meshes.map((m) => m.name)).toEqual(['body', 'eyes'])
    for (const m of c.meshes) expect(m).toBeInstanceOf(SkinnedMesh)
    const body = c.meshes[0]!
    expect(Object.keys(body.morphTargetDictionary!)).toEqual([
      'LeftUpperLidClosed',
      'JawDrop',
    ])
    expect(body.geometry.morphTargetsRelative).toBe(true)
    const jaw = body.morphTargetDictionary!.JawDrop!
    // A vertex the jaw moves.
    const deltas = built.meshes[0]!.morphs[1]!.positions
    let v = 0
    while (deltas[v * 3 + 1] === 0) v++
    const before = drawn(body, v).y
    c.setFaceUnit('JawDrop', 1)
    expect(body.morphTargetInfluences![jaw]).toBe(1)
    expect(drawn(body, v).y - before).toBeCloseTo(deltas[v * 3 + 1]!, 4)
    c.setFaceUnit('JawDrop', 3)
    expect(body.morphTargetInfluences![jaw]).toBe(1) // clamped
    // A unit only the eyes have leaves the body alone.
    c.setFaceUnit('LeftEyeturnLeft', 0.5)
    const eyes = c.meshes[1]!
    expect(
      eyes.morphTargetInfluences![eyes.morphTargetDictionary!.LeftEyeturnLeft!]
    ).toBe(0.5)
  })

  test('materials: standard, sheen as physical, alpha modes, linear colour', () => {
    const b: BuiltCharacter = {
      ...built,
      materials: [
        { ...built.materials[0]!, alphaMode: 'MASK', alphaCutoff: 0.3 },
        {
          ...built.materials[1]!,
          alphaMode: 'BLEND',
          doubleSided: true,
          sheen: { colorFactor: [1, 0, 0], roughnessFactor: 0.4 },
        },
      ],
    }
    const c = characterObject(b)
    const skin = c.meshes[0]!.material as MeshStandardMaterial
    expect(skin.type).toBe('MeshStandardMaterial')
    expect(skin.alphaTest).toBe(0.3)
    expect(skin.color.r).toBeCloseTo(0.6, 6) // linear, unconverted
    const cloth = c.meshes[1]!.material as MeshPhysicalMaterial
    expect(cloth).toBeInstanceOf(MeshPhysicalMaterial)
    expect(cloth.sheen).toBe(1)
    expect(cloth.sheenRoughness).toBe(0.4)
    expect(cloth.transparent).toBe(true)
    expect(cloth.depthWrite).toBe(false)
  })

  test('textures: shared per image and colour space, glTF uv convention', () => {
    const png = new Uint8Array([137, 80, 78, 71])
    const b: BuiltCharacter = {
      ...built,
      images: [{ name: 'skin', mimeType: 'image/png', bytes: png, asset: 'x' }],
      materials: [
        {
          ...built.materials[0]!,
          baseColorTexture: { image: 0 },
          metallicRoughnessTexture: { image: 0 },
          normalTexture: { image: 0, scale: 0.5 },
        },
        { ...built.materials[1]!, baseColorTexture: { image: 0 } },
      ],
    }
    const c = characterObject(b)
    const m0 = c.meshes[0]!.material as MeshStandardMaterial
    const m1 = c.meshes[1]!.material as MeshStandardMaterial
    expect(m0.map).toBe(m1.map)
    expect(m0.roughnessMap).toBe(m0.metalnessMap)
    expect(m0.roughnessMap).not.toBe(m0.map) // sRGB vs data
    expect(m0.map!.flipY).toBe(false)
    expect(m0.map!.colorSpace).toBe('srgb')
    expect([m0.normalScale.x, m0.normalScale.y]).toEqual([0.5, -0.5])
    c.dispose()
  })

  test('a UAL clip plays by name and moves the limbs and the skin', async () => {
    const c = characterObject(built)
    const clip = characterClip(await walkClip())
    const mixer = new AnimationMixer(c.root)
    mixer.clipAction(clip).play()
    const bound = new Set(
      clip.tracks.map((t) => PropertyBinding.parseTrackName(t.name).nodeName)
    )
    for (const j of MAJOR_JOINTS) expect(bound.has(j)).toBe(true)
    const hand = c.skeleton.getBoneByName('hand_l')!
    const at = (t: number): Vector3 => {
      mixer.setTime(t)
      c.root.updateMatrixWorld(true)
      return hand.getWorldPosition(new Vector3())
    }
    const a = at(0)
    const b = at(clip.duration / 2)
    expect(a.distanceTo(b)).toBeGreaterThan(0.01)
    // Only rotations, plus root and pelvis translation, survive.
    for (const t of clip.tracks) {
      const p = PropertyBinding.parseTrackName(t.name)
      if (p.propertyName !== 'quaternion')
        expect(['root', 'pelvis']).toContain(p.nodeName!)
    }
  })
})

describe('updateCharacterObject', () => {
  test('a slider change updates in place: same objects, new shape', () => {
    const c = characterObject(fixtureCharacter(rest))
    const { root, skeleton } = c
    const body = c.meshes[0]!
    const material = body.material
    c.setFaceUnit('JawDrop', 0.7)
    const tall = fixtureCharacter(rest, { height: 1.2, arms: 1.1 })
    updateCharacterObject(c, tall)
    expect(c.root).toBe(root)
    expect(c.skeleton).toBe(skeleton)
    expect(c.meshes[0]).toBe(body) // same topology: rewritten, not remade
    expect(body.material).toBe(material)
    expect(
      body.morphTargetInfluences![body.morphTargetDictionary!.JawDrop!]
    ).toBe(0.7)
    c.root.updateMatrixWorld(true)
    const head = skeleton.getBoneByName('Head')!.getWorldPosition(new Vector3())
    const want =
      tall.skeleton.joints[UE_JOINTS.findIndex((j) => j.name === 'Head')]!
    expect(head.distanceTo(new Vector3(...want.position))).toBeLessThan(1e-5)
    c.setFaceUnit('JawDrop', 0)
    const v = 5
    const wantV = new Vector3().fromArray(tall.meshes[0]!.positions, v * 3)
    expect(drawn(body, v).distanceTo(wantV)).toBeLessThan(1e-5)
  })

  test('a changed mesh list remakes what changed and drops what went', () => {
    const built = fixtureCharacter(rest)
    const c = characterObject(built)
    const eyes = c.meshes[1]!
    const fewer: BuiltCharacter = { ...built, meshes: [built.meshes[0]!] }
    updateCharacterObject(c, fewer)
    expect(c.meshes.map((m) => m.name)).toEqual(['body'])
    expect(eyes.parent).toBe(null)
    updateCharacterObject(c, built)
    expect(c.meshes.map((m) => m.name)).toEqual(['body', 'eyes'])
    expect(c.meshes[1]).not.toBe(eyes)
    expect(c.meshes[1]!.skeleton).toBe(c.skeleton)
  })

  test('a changed material colour is applied to the same material', () => {
    const built = fixtureCharacter(rest)
    const c = characterObject(built)
    const skin = c.meshes[0]!.material as MeshStandardMaterial
    const tanned: BuiltCharacter = {
      ...built,
      materials: [
        { ...built.materials[0]!, baseColorFactor: [0.3, 0.2, 0.1, 1] },
        built.materials[1]!,
      ],
    }
    updateCharacterObject(c, tanned)
    expect(c.meshes[0]!.material).toBe(skin)
    expect(skin.color.r).toBeCloseTo(0.3, 6)
  })

  test('refuses a different skeleton, and a disposed object', () => {
    const built = fixtureCharacter(rest)
    const c = characterObject(built)
    const short: BuiltCharacter = {
      ...built,
      skeleton: { joints: built.skeleton.joints.slice(0, 10) },
    }
    expect(() => updateCharacterObject(c, short)).toThrow('skeleton changed')
    c.dispose()
    expect(() => updateCharacterObject(c, built)).toThrow('disposed')
  })
})

// The contract's claim: the same scene graph GLTFLoader gives for
// writeCharacterGlb(built). Runs once the skinned-glb lane's writer exists.
const writerExists = (() => {
  try {
    writeCharacterGlb(fixtureCharacter(rest))
    return true
  } catch (e) {
    return !(e as Error).message.startsWith('not implemented:')
  }
})()

describe('characterObject matches GLTFLoader on writeCharacterGlb', () => {
  const name = writerExists
    ? 'bones, meshes, morph names and materials match'
    : 'NOT RUN (writeCharacterGlb is not implemented yet): bones, meshes, morph names and materials match'
  test.skipIf(!writerExists)(name, async () => {
    const built = fixtureCharacter(rest)
    const bytes = writeCharacterGlb(built)
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      ''
    )
    const loaded: SkinnedMesh[] = []
    gltf.scene.traverse((o) => {
      if (o instanceof SkinnedMesh) loaded.push(o)
    })
    const c = characterObject(built)
    expect(loaded.map((m) => m.name)).toEqual(c.meshes.map((m) => m.name))
    expect(loaded[0]!.skeleton.bones.map((b) => b.name)).toEqual(
      c.skeleton.bones.map((b) => b.name)
    )
    loaded.forEach((m, i) => {
      expect(Object.keys(m.morphTargetDictionary ?? {})).toEqual(
        Object.keys(c.meshes[i]!.morphTargetDictionary ?? {})
      )
      expect((m.material as MeshStandardMaterial).type).toBe(
        (c.meshes[i]!.material as MeshStandardMaterial).type
      )
    })
  })
})
