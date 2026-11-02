// The VRM export, offline: on the committed sample GLBs (real characters,
// written by bin/export-sample.ts) and on the three lane's fixture character.
// Each VRM is checked four ways: the lane's own structural check of
// VRMC_vrm (vrmProblems), the Khronos validator (zero errors), the gate-1
// profile checks (a VRM is still a profile GLB), and loading with
// @pixiv/three-vrm under three.js, where the humanoid, the expressions and
// the look-at are driven and their effect on the meshes measured.

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type VRM,
  VRMExpressionPresetName,
  VRMLoaderPlugin,
} from '@pixiv/three-vrm'
import { type Object3D, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { writeCharacterGlb } from '../build'
import type { ExportExtras } from '../contracts/profile'
import { FACE_UNITS, UE_JOINT_NAMES } from '../contracts/profile'
import { fixtureCharacter, ualRest } from '../three/fixture-character'
import {
  licenceProblems,
  morphProblems,
  skeletonProblems,
  validatorErrors,
} from '../../test/gate1/checks'
import { readGlb, readVec3 } from 'tosijs-3d/glb-chunks'
import {
  measureEyes,
  VRM_HUMAN_BONES,
  VRM_PRESETS,
  VRM_REQUIRED_BONES,
  vrmFromGlb,
  vrmJsonProblems,
  vrmMeta,
  vrmProblems,
  writeCharacterVrm,
} from '.'

const ROOT = join(import.meta.dir, '..', '..')
const OUT = join(ROOT, 'samples', 'out')
const glbBytes = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(OUT, name)))
const SAMPLES = readdirSync(OUT)
  .filter((f) => f.endsWith('.glb'))
  .sort()
const UE_SAMPLES = SAMPLES.filter((f) => {
  const extras = readGlb(glbBytes(f)).json.asset.extras.dramatis
  return extras.naming === 'ue' && extras.restPose === 't-pose'
})

const rest = ualRest(
  new Uint8Array(
    readFileSync(join(ROOT, 'test', 'gate1', 'fixtures', 'ual-walk.glb'))
  )
)

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

function skinned(scene: Object3D, name: string): SkinnedMesh {
  let found: SkinnedMesh | undefined
  scene.traverse((o) => {
    if (o instanceof SkinnedMesh && o.name === name) found = o
  })
  if (found === undefined) throw new Error(`no skinned mesh ${name}`)
  return found
}

describe('the tables', () => {
  test('every human bone is a profile joint, once; root and the leaves are not bones', () => {
    const joints = Object.values(VRM_HUMAN_BONES)
    expect(joints.length).toBe(52)
    expect(new Set(joints).size).toBe(joints.length)
    for (const j of joints) expect(UE_JOINT_NAMES).toContain(j)
    expect(joints).not.toContain('root')
    expect(joints.some((j) => j.includes('leaf'))).toBe(false)
    for (const b of VRM_REQUIRED_BONES) expect(VRM_HUMAN_BONES[b]).toBeDefined()
    // Every profile joint but root and the 10 leaves (and the 2 toe leaves) is a bone.
    expect(UE_JOINT_NAMES.length - joints.length).toBe(13)
  })

  test('every preset names real face units, once each, with weights in (0, 1]', () => {
    const names = VRM_PRESETS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const want of [
      'aa',
      'ih',
      'ou',
      'ee',
      'oh',
      'blink',
      'blinkLeft',
      'blinkRight',
      'happy',
      'angry',
      'sad',
      'relaxed',
      'surprised',
      'lookUp',
      'lookDown',
      'lookLeft',
      'lookRight',
    ])
      expect(names).toContain(want as never)
    for (const p of VRM_PRESETS) {
      expect(p.units.length).toBeGreaterThan(0)
      const units = p.units.map(([u]) => u)
      expect(new Set(units).size).toBe(units.length)
      for (const [u, w] of p.units) {
        expect(FACE_UNITS).toContain(u)
        expect(w).toBeGreaterThan(0)
        expect(w).toBeLessThanOrEqual(1)
      }
      expect(p.why.length).toBeGreaterThan(10)
    }
  })
})

describe('meta follows the licences', () => {
  const extras = (licence: string, attribution?: string): ExportExtras => ({
    format: 'dramatis-export',
    version: 1,
    generator: 'dramatis@test',
    naming: 'ue',
    restPose: 't-pose',
    faceUnits: [],
    character: 'Test',
    licences: [
      {
        asset: 'makehuman:base/hm08',
        title: 'Base',
        kind: 'base',
        licence: 'CC0-1.0',
        licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        source: 'https://example.org/a',
        author: 'A',
      },
      {
        asset: 'x:garment/y',
        title: 'Y',
        kind: 'garment',
        licence,
        licenceUrl: 'https://example.org/licence',
        source: 'https://example.org/b',
        author: 'B',
        ...(attribution !== undefined ? { attribution } : {}),
      },
    ],
  })

  test('all CC0: anyone, commercially, no credit needed', () => {
    const m = vrmMeta(extras('CC0-1.0'), 'c')
    expect(m.creditNotation).toBe('unnecessary')
    expect(m.commercialUsage).toBe('corporation')
    expect(m.modification).toBe('allowModificationRedistribution')
    expect(m.avatarPermission).toBe('everyone')
    expect(m.licenseUrl).toBe('https://vrm.dev/licenses/1.0/')
    expect(m.copyrightInformation).toBe('c')
    expect(m.name).toBe('Test')
    expect(m.authors).toEqual(['Dramatis user'])
  })

  test('CC BY: credit required, its credit line carried word for word', () => {
    const m = vrmMeta(extras('CC-BY-4.0', 'Y by B, CC BY 4.0'), undefined)
    expect(m.creditNotation).toBe('required')
    expect(m.thirdPartyLicenses).toContain('credit: Y by B, CC BY 4.0')
    expect(m.copyrightInformation).toBeUndefined()
  })

  test('NC and ND narrow the terms', () => {
    expect(vrmMeta(extras('CC-BY-NC-4.0', 'x'), 'c').commercialUsage).toBe(
      'personalNonProfit'
    )
    expect(vrmMeta(extras('CC-BY-ND-4.0', 'x'), 'c').modification).toBe(
      'prohibited'
    )
  })

  test('the caller names the model and its authors', () => {
    const m = vrmMeta(extras('CC0-1.0'), 'c', {
      name: 'Ada',
      authors: ['Ada L.'],
      contactInformation: 'ada@example.org',
    })
    expect(m.name).toBe('Ada')
    expect(m.authors).toEqual(['Ada L.'])
    expect(m.contactInformation).toBe('ada@example.org')
  })
})

describe('the fixture character', () => {
  test('a VRM is the GLB export with VRMC_vrm added, and its binary chunk byte for byte', () => {
    const built = fixtureCharacter(rest)
    const glb = writeCharacterGlb(built, { naming: 'ue' })
    const vrm = writeCharacterVrm(built)
    const a = readGlb(glb)
    const b = readGlb(vrm)
    expect(Buffer.from(b.bin!).equals(Buffer.from(a.bin!))).toBe(true)
    const { extensions, extensionsUsed, ...rest2 } = b.json
    const { extensions: e0, extensionsUsed: u0, ...rest1 } = a.json
    expect(rest2).toEqual(rest1)
    expect(e0).toBeUndefined()
    expect(u0).toBeUndefined()
    expect(extensionsUsed).toEqual(['VRMC_vrm'])
    expect(Object.keys(extensions)).toEqual(['VRMC_vrm'])
    expect(vrmProblems(vrm)).toEqual([])
  })

  test('it binds only the units the file has', () => {
    const vrm = writeCharacterVrm(fixtureCharacter(rest))
    const preset = readGlb(vrm).json.extensions.VRMC_vrm.expressions
      .preset as Record<string, unknown>
    // The fixture has LeftUpperLidClosed, JawDrop and LeftEyeturnLeft.
    expect(Object.keys(preset).sort()).toEqual(
      [
        'aa',
        'blink',
        'blinkLeft',
        'ee',
        'ih',
        'lookLeft',
        'oh',
        'ou',
        'relaxed',
        'sad',
        'surprised',
      ].sort()
    )
    // Only lookLeft of the four: no lookAt rather than a lopsided one.
    expect(vrmProblems(vrm)).toEqual([])
    const json = readGlb(vrm).json
    expect(json.extensions.VRMC_vrm.lookAt).toBeUndefined()
  })

  test('the source rest pose and Mixamo naming are refused', () => {
    const built = fixtureCharacter(rest)
    expect(() => writeCharacterVrm({ ...built, restPose: 'source' })).toThrow(
      /T-pose/
    )
    expect(() =>
      vrmFromGlb(writeCharacterGlb(built, { naming: 'mixamo' }))
    ).toThrow(/ue naming/)
  })
})

describe('the checker can fail', () => {
  const vrm = vrmFromGlb(glbBytes(UE_SAMPLES[0]!))
  const json = (): ReturnType<typeof readGlb>['json'] => readGlb(vrm).json

  test('on a missing required bone, a shared node, a bad hierarchy', () => {
    const j = json()
    const bones = j.extensions.VRMC_vrm.humanoid.humanBones
    delete bones.leftHand
    bones.chest = { node: bones.neck.node }
    const problems = vrmJsonProblems(j).join('\n')
    expect(problems).toContain('humanBones lacks leftHand')
    expect(problems).toContain('share node')
    expect(problems).toContain('nearest human ancestor')
  })

  test('on a bind past the targets, a bad weight, an unknown preset', () => {
    const j = json()
    const p = j.extensions.VRMC_vrm.expressions.preset
    p.aa.morphTargetBinds[0].index = 999
    p.aa.morphTargetBinds[1] = { ...p.aa.morphTargetBinds[0], weight: 2 }
    p.smile = { morphTargetBinds: [] }
    const problems = vrmJsonProblems(j).join('\n')
    expect(problems).toContain('aa.morphTargetBinds[0].index is not one of')
    expect(problems).toContain('weight is not in [0, 1]')
    expect(problems).toContain('smile is not a VRM preset')
  })

  test('on meta without a licence URL or authors', () => {
    const j = json()
    delete j.extensions.VRMC_vrm.meta.licenseUrl
    j.extensions.VRMC_vrm.meta.authors = []
    j.extensions.VRMC_vrm.meta.commercialUsage = 'anyone'
    const problems = vrmJsonProblems(j).join('\n')
    expect(problems).toContain('meta.licenseUrl is missing')
    expect(problems).toContain('meta.authors')
    expect(problems).toContain('meta.commercialUsage')
  })
})

describe('the face units do what the presets assume (measured on a sample)', () => {
  const g = readGlb(glbBytes(UE_SAMPLES[0]!))
  const meshNode = (name: string) => {
    const mesh = g.json.meshes.findIndex(
      (m: { name: string }) => m.name === name
    )
    return {
      prim: g.json.meshes[mesh].primitives[0],
      names: g.json.meshes[mesh].extras.targetNames as string[],
    }
  }
  /** The movement-weighted mean x of the vertices a unit moves, and the mean delta. */
  const where = (mesh: string, unit: string) => {
    const { prim, names } = meshNode(mesh)
    const pos = readVec3(g, prim.attributes.POSITION)
    const d = readVec3(g, prim.targets[names.indexOf(unit)].POSITION)
    let x = 0
    let dx = 0
    let w = 0
    for (let v = 0; v < pos.length / 3; v++) {
      const m = Math.hypot(d[v * 3]!, d[v * 3 + 1]!, d[v * 3 + 2]!)
      x += pos[v * 3]! * m
      dx += d[v * 3]! * m
      w += m
    }
    return { x: x / w, dx: dx / w }
  }

  test("Left units move the character's left (+X): blinkLeft is the left lid", () => {
    expect(where('body', 'LeftUpperLidClosed').x).toBeGreaterThan(0.02)
    expect(where('body', 'RightUpperLidClosed').x).toBeLessThan(-0.02)
  })

  test("EyeturnLeft turns both eyes to +X, the character's left, VRM's lookLeft", () => {
    expect(where('eyes', 'LeftEyeturnLeft').dx).toBeGreaterThan(0.001)
    expect(where('eyes', 'RightEyeturnLeft').dx).toBeGreaterThan(0.001)
    expect(where('eyes', 'LeftEyeturnRight').dx).toBeLessThan(-0.001)
  })

  test('the eyes turn 15 to 40 degrees at weight 1, and sit in front of and above the head joint', () => {
    const eyes = measureEyes(g)!
    for (const p of ['lookUp', 'lookDown', 'lookLeft', 'lookRight'] as const) {
      expect(eyes.turn[p]).toBeGreaterThan(15)
      expect(eyes.turn[p]).toBeLessThan(40)
    }
    expect(eyes.centre[0]).toBeCloseTo(0, 3)
    expect(eyes.centre[2]).toBeGreaterThan(0.05)
  })
})

describe.each(UE_SAMPLES)('%s as VRM', (file) => {
  const glb = glbBytes(file)
  const vrmBytes = vrmFromGlb(glb, { authors: ['Sample author'] })

  test('passes the structural check', () => {
    expect(vrmProblems(vrmBytes)).toEqual([])
  })

  test('the Khronos validator reports zero errors', async () => {
    expect(await validatorErrors(vrmBytes)).toEqual([])
  })

  test('is still a profile GLB (gate-1 skeleton, morph and licence checks)', () => {
    const g = readGlb(vrmBytes)
    expect(skeletonProblems(g)).toEqual([])
    expect(morphProblems(g)).toEqual([])
    expect(licenceProblems(g)).toEqual([])
  })

  test('three-vrm loads it: meta, every bone, every preset', async () => {
    const vrm = await loadVrm(vrmBytes)
    expect(vrm.meta.metaVersion).toBe('1')
    const meta = vrm.meta as { name: string; authors: string[] }
    expect(meta.authors).toEqual(['Sample author'])
    for (const [bone, joint] of Object.entries(VRM_HUMAN_BONES))
      expect(vrm.humanoid.getRawBoneNode(bone as never)?.name).toBe(joint)
    const em = vrm.expressionManager!
    for (const p of VRM_PRESETS) expect(em.getExpression(p.name)).not.toBeNull()
    expect(vrm.lookAt).not.toBeNull()
  })

  test('three-vrm: aa opens the jaw by the bound weight, on the body and the teeth', async () => {
    const vrm = await loadVrm(vrmBytes)
    const body = skinned(vrm.scene, 'body')
    const jaw = body.morphTargetDictionary!.JawDrop!
    vrm.expressionManager!.setValue(VRMExpressionPresetName.Aa, 1)
    vrm.update(0)
    expect(body.morphTargetInfluences![jaw]).toBeCloseTo(0.8, 5)
    const teeth = skinned(vrm.scene, 'teeth')
    expect(
      teeth.morphTargetInfluences![teeth.morphTargetDictionary!.JawDrop!]
    ).toBeCloseTo(0.8, 5)
    vrm.expressionManager!.setValue(VRMExpressionPresetName.Aa, 0)
    vrm.expressionManager!.setValue(VRMExpressionPresetName.BlinkLeft, 1)
    vrm.update(0)
    expect(body.morphTargetInfluences![jaw]).toBe(0)
    const d = body.morphTargetDictionary!
    expect(body.morphTargetInfluences![d.LeftUpperLidClosed!]).toBe(1)
    expect(body.morphTargetInfluences![d.RightUpperLidClosed!]).toBe(0)
  })

  test("three-vrm: looking at a point on the character's left turns the eyes left", async () => {
    const vrm = await loadVrm(vrmBytes)
    vrm.scene.updateMatrixWorld(true)
    const eyes = skinned(vrm.scene, 'eyes')
    const head = vrm.humanoid.getRawBoneNode('head')!
    const at = head.getWorldPosition(new Vector3())
    // A point 1 m ahead and 0.3 m to the character's left (+X): about 17 degrees.
    vrm.lookAt!.lookAt(at.clone().add(new Vector3(0.3, 0, 1)))
    vrm.update(0)
    const em = vrm.expressionManager!
    expect(em.getValue('lookLeft')).toBeGreaterThan(0.3)
    expect(em.getValue('lookRight')).toBe(0)
    const d = eyes.morphTargetDictionary!
    expect(eyes.morphTargetInfluences![d.LeftEyeturnLeft!]).toBeGreaterThan(0.3)
    expect(eyes.morphTargetInfluences![d.LeftEyeturnRight!]).toBe(0)
  })

  test('three-vrm: the normalized rig is a T-pose facing +Z, and it drives the raw joints', async () => {
    const vrm = await loadVrm(vrmBytes)
    vrm.update(0)
    vrm.scene.updateMatrixWorld(true)
    const raw = (b: string): Vector3 =>
      vrm.humanoid.getRawBoneNode(b as never)!.getWorldPosition(new Vector3())
    const shoulder = raw('leftUpperArm')
    const hand = raw('leftHand')
    // T-pose: the left hand out on +X at the shoulder's height.
    expect(hand.x - shoulder.x).toBeGreaterThan(0.35)
    expect(Math.abs(hand.y - shoulder.y)).toBeLessThan(0.08)
    expect(raw('rightHand').x).toBeLessThan(-0.35)
    // Facing +Z: the toes are in front of the ankles.
    expect(raw('leftToes').z).toBeGreaterThan(raw('leftFoot').z)
    // Lower the left arm by 80 degrees on the normalized rig. Its frame is
    // the model's, so turning about -Z takes +X towards -Y.
    vrm.humanoid
      .getNormalizedBoneNode('leftUpperArm')!
      .rotation.set(0, 0, (-80 * Math.PI) / 180)
    vrm.update(0)
    vrm.scene.updateMatrixWorld(true)
    const lowered = raw('leftHand')
    expect(lowered.y).toBeLessThan(shoulder.y - 0.3)
    expect(lowered.x - shoulder.x).toBeLessThan(0.15)
  })
})

test('NOT a VRM: a Mixamo-named sample is refused with a reason', () => {
  const mixamo = SAMPLES.find((f) => !UE_SAMPLES.includes(f))
  if (mixamo === undefined) return
  expect(() => vrmFromGlb(glbBytes(mixamo))).toThrow(/ue naming/)
})

test('site/docs/vrm.md tabulates every preset exactly as the code has it', () => {
  const page = readFileSync(join(ROOT, 'site', 'docs', 'vrm.md'), 'utf8')
  for (const p of VRM_PRESETS) {
    const overrides =
      [
        p.overrideBlink && `blink ${p.overrideBlink}`,
        p.overrideLookAt && `look-at ${p.overrideLookAt}`,
        p.overrideMouth && `mouth ${p.overrideMouth}`,
      ]
        .filter(Boolean)
        .join(', ') || 'none'
    const units = p.units.map(([u, w]) => `\`${u}\` ${w}`).join(', ')
    expect(page).toContain(
      `| \`${p.name}\` | ${units} | ${overrides} | ${p.why} |`
    )
  }
})
