// A small hand-made BuiltCharacter, to the contract: UAL's 65 joints at UAL's
// own rest (read from a UAL GLB), a blocky body of one box per bone skinned to
// it, a head with two face units, eyes with one, and a flat skin and eye
// material. It stands in for the skinned-glb lane's builder in the adapter's
// tests and in samples/three/ until `buildCharacter` exists. It is not part of
// any public entry and proves nothing about the builder.
//
// The sliders (`FixtureShape`) change joint translations and the boxes, which
// is enough to exercise the adapter's live-update path: same skeleton, new
// rest, new inverse binds, new vertices.

import { Matrix4, Quaternion, Vector3 } from 'three'
import { parseGlbJson } from 'tosijs-3d/glb-manifest'
import type {
  BuiltCharacter,
  BuiltJoint,
  BuiltMesh,
  Quat,
  Vec3,
} from '../contracts/built-character'
import type { LicenceEntry } from '../contracts/licences'
import { type FaceUnitName, UE_JOINTS } from '../contracts/profile'

/** A joint's rest transform relative to its parent, by UE name. */
export interface JointRest {
  translation: Vec3
  rotation: Quat
}

/** The rest transforms of UAL's joints from a UAL GLB (e.g. test/gate1/fixtures/ual-walk.glb). */
export function ualRest(glb: Uint8Array): Map<string, JointRest> {
  const json = parseGlbJson(glb) as {
    nodes: { name?: string; translation?: number[]; rotation?: number[] }[]
  } | null
  if (json === null) throw new Error('not a GLB')
  const out = new Map<string, JointRest>()
  for (const n of json.nodes) {
    if (n.name === undefined) continue
    out.set(n.name, {
      translation: (n.translation ?? [0, 0, 0]) as Vec3,
      rotation: (n.rotation ?? [0, 0, 0, 1]) as Quat,
    })
  }
  return out
}

/** The fixture's sliders. 1 is UAL's mannequin. */
export interface FixtureShape {
  /** Scales every bone. */
  height?: number
  /** Scales the arm bones (upper arm, forearm, hand) on top of `height`. */
  arms?: number
  /** Scales the boxes' thickness. */
  bulk?: number
}

export const FIXTURE_FACE_UNITS: FaceUnitName[] = [
  'LeftUpperLidClosed',
  'JawDrop',
  'LeftEyeturnLeft',
]

const LICENCE: LicenceEntry = {
  asset: 'quaternius:animation/ual1',
  title: 'Universal Animation Library (skeleton rest pose)',
  kind: 'animation',
  licence: 'CC0-1.0',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  source: 'https://quaternius.com',
  author: 'Quaternius',
}

const ARM = /^(upperarm|lowerarm|hand)_/

/** Box half-thickness per bone, metres (UAL mannequin scale). */
function thickness(name: string): number {
  if (/^(index|middle|ring|pinky|thumb)_/.test(name)) return 0.008
  if (name.startsWith('spine') || name === 'pelvis') return 0.11
  if (name.startsWith('thigh')) return 0.07
  if (name.startsWith('calf')) return 0.05
  if (name.startsWith('upperarm')) return 0.045
  if (name.startsWith('lowerarm')) return 0.035
  if (name.startsWith('clavicle')) return 0.04
  if (name.startsWith('neck')) return 0.045
  if (name.startsWith('foot') || name.startsWith('ball')) return 0.04
  if (name.startsWith('hand')) return 0.03
  return 0.02
}

/** Build the fixture character from UAL's rest transforms. */
export function fixtureCharacter(
  rest: Map<string, JointRest>,
  shape: FixtureShape = {}
): BuiltCharacter {
  const height = shape.height ?? 1
  const arms = shape.arms ?? 1
  const bulk = shape.bulk ?? 1
  const index = new Map(UE_JOINTS.map((j, i) => [j.name, i]))

  const world: Matrix4[] = []
  const joints: BuiltJoint[] = UE_JOINTS.map((row, i) => {
    const r = rest.get(row.name)
    if (r === undefined) throw new Error(`rest lacks ${row.name}`)
    const parent = row.parent === null ? -1 : index.get(row.parent)!
    const k = row.parent === null ? 1 : height * (ARM.test(row.name) ? arms : 1)
    const translation = r.translation.map((v) => v * k) as Vec3
    const local = new Matrix4().compose(
      new Vector3(...translation),
      new Quaternion(...r.rotation),
      new Vector3(1, 1, 1)
    )
    const w =
      parent < 0 ? local : new Matrix4().multiplyMatrices(world[parent]!, local)
    world[i] = w
    const p = new Vector3().setFromMatrixPosition(w)
    return {
      name: row.name,
      parent,
      translation,
      rotation: [...r.rotation] as Quat,
      position: [p.x, p.y, p.z],
      inverseBind: Float32Array.from(w.clone().invert().elements),
    }
  })

  const at = (name: string): Vector3 =>
    new Vector3(...joints[index.get(name)!]!.position)

  // Body: a box from each joint to each child, rigid on the joint.
  const body = new MeshBuilder()
  joints.forEach((joint, i) => {
    if (joint.parent <= 0) return // root, and root -> pelvis
    const parent = joints[joint.parent]!
    if (parent.name === 'Head') return
    const a = new Vector3(...parent.position)
    const b = new Vector3(...joint.position)
    if (a.distanceTo(b) < 1e-4) return
    body.box(a, b, thickness(parent.name) * bulk * height, joint.parent)
    void i
  })
  // Head: a box around the head joint, its lower half the jaw.
  const head = index.get('Head')!
  const headAt = at('Head')
  const headSize = 0.11 * height
  const headStart = body.count
  body.cube(headAt.clone().add(new Vector3(0, headSize, 0)), headSize, head)
  const jaw = new Float32Array(body.count * 3)
  const lid = new Float32Array(body.count * 3)
  for (let v = headStart; v < body.count; v++) {
    const y = body.positions[v * 3 + 1]!
    const z = body.positions[v * 3 + 2]!
    const x = body.positions[v * 3]!
    if (y < headAt.y + headSize * 0.6) jaw[v * 3 + 1] = -0.04 * height
    // The front-left top corner: a lid, of sorts.
    if (z > headAt.z && x > headAt.x && y > headAt.y + headSize)
      lid[v * 3 + 1] = -0.03 * height
  }

  // Eyes: two small cubes on the face, the left one turned by a unit.
  const eyes = new MeshBuilder()
  const eyeAt = headAt.clone().add(new Vector3(0, headSize * 1.2, headSize))
  const half = 0.012 * height
  eyes.cube(eyeAt.clone().add(new Vector3(0.04 * height, 0, 0)), half, head)
  const leftEnd = eyes.count
  eyes.cube(eyeAt.clone().add(new Vector3(-0.04 * height, 0, 0)), half, head)
  const turn = new Float32Array(eyes.count * 3)
  for (let v = 0; v < leftEnd; v++) turn[v * 3] = 0.008 * height

  const meshes: BuiltMesh[] = [
    body.mesh('body', 'quaternius:animation/ual1', 0, [
      { name: 'LeftUpperLidClosed', positions: lid, normals: null },
      { name: 'JawDrop', positions: jaw, normals: null },
    ]),
    eyes.mesh('eyes', 'quaternius:animation/ual1', 1, [
      { name: 'LeftEyeturnLeft', positions: turn, normals: null },
    ]),
  ]

  return {
    name: 'fixture',
    restPose: 't-pose',
    skeleton: { joints },
    meshes,
    materials: [
      {
        name: 'skin',
        baseColorFactor: [0.6, 0.38, 0.28, 1],
        metallicFactor: 0,
        roughnessFactor: 0.6,
        alphaMode: 'OPAQUE',
        doubleSided: false,
      },
      {
        name: 'eyes',
        baseColorFactor: [0.9, 0.9, 0.9, 1],
        metallicFactor: 0,
        roughnessFactor: 0.2,
        alphaMode: 'OPAQUE',
        doubleSided: false,
      },
    ],
    images: [],
    faceUnits: [...FIXTURE_FACE_UNITS],
    licences: [LICENCE],
  }
}

/** Flat-shaded boxes, each rigid on one joint. */
class MeshBuilder {
  positions: number[] = []
  normals: number[] = []
  indices: number[] = []
  joints: number[] = []
  get count(): number {
    return this.positions.length / 3
  }

  /** A box from a to b, `r` thick each side, on `joint`. */
  box(a: Vector3, b: Vector3, r: number, joint: number): void {
    const axis = b.clone().sub(a)
    const up =
      Math.abs(axis.clone().normalize().y) > 0.9
        ? new Vector3(1, 0, 0)
        : new Vector3(0, 1, 0)
    const u = new Vector3().crossVectors(axis, up).normalize().multiplyScalar(r)
    const v = new Vector3().crossVectors(axis, u).normalize().multiplyScalar(r)
    this.prism(a, axis, u, v, joint)
  }

  /** An axis-aligned cube centred on c. */
  cube(c: Vector3, half: number, joint: number): void {
    const a = c.clone().add(new Vector3(0, -half, 0))
    this.prism(
      a,
      new Vector3(0, 2 * half, 0),
      new Vector3(half, 0, 0),
      new Vector3(0, 0, half),
      joint
    )
  }

  /** The box a + s*axis + t*u + w*v for s in 0..1, t, w in -1..1. */
  private prism(
    a: Vector3,
    axis: Vector3,
    u: Vector3,
    v: Vector3,
    joint: number
  ): void {
    const corner = (s: number, t: number, w: number): Vector3 =>
      a
        .clone()
        .addScaledVector(axis, s)
        .addScaledVector(u, t)
        .addScaledVector(v, w)
    // Six faces, each as four corners (s,t,w) wound so the normal points out.
    const faces: [number, number, number][][] = [
      [
        [0, -1, -1],
        [0, -1, 1],
        [0, 1, 1],
        [0, 1, -1],
      ],
      [
        [1, -1, -1],
        [1, 1, -1],
        [1, 1, 1],
        [1, -1, 1],
      ],
      [
        [0, -1, -1],
        [1, -1, -1],
        [1, -1, 1],
        [0, -1, 1],
      ],
      [
        [0, 1, -1],
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, -1],
      ],
      [
        [0, -1, -1],
        [0, 1, -1],
        [1, 1, -1],
        [1, -1, -1],
      ],
      [
        [0, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
    ]
    const centre = corner(0.5, 0, 0)
    for (const face of faces) {
      const q = face.map(([s, t, w]) => corner(s, t, w))
      let n = new Vector3()
        .subVectors(q[1]!, q[0]!)
        .cross(new Vector3().subVectors(q[2]!, q[0]!))
        .normalize()
      const base = this.count
      // Wind counter-clockwise from outside whatever the basis' handedness.
      const out = q[0]!.clone().sub(centre).dot(n) > 0
      if (!out) n = n.negate()
      for (const p of q) {
        this.positions.push(p.x, p.y, p.z)
        this.normals.push(n.x, n.y, n.z)
        this.joints.push(joint, 0, 0, 0)
      }
      if (out)
        this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
      else this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
  }

  mesh(
    name: string,
    asset: string,
    material: number,
    morphs: BuiltMesh['morphs']
  ): BuiltMesh {
    const n = this.count
    const weights = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) weights[i * 4] = 1
    return {
      name,
      role: name === 'body' ? 'body' : 'eyes',
      asset,
      positions: Float32Array.from(this.positions),
      normals: Float32Array.from(this.normals),
      uvs: null,
      indices: Uint32Array.from(this.indices),
      skin: { joints: Uint16Array.from(this.joints), weights },
      morphs: morphs.map((m) => ({
        ...m,
        positions:
          m.positions.length === n * 3
            ? m.positions
            : resize(m.positions, n * 3),
      })),
      material,
    }
  }
}

function resize(a: Float32Array, length: number): Float32Array {
  const out = new Float32Array(length)
  out.set(a.subarray(0, Math.min(a.length, length)))
  return out
}
