// Normalised bones for VRM: every joint at rest with no rotation and unit
// scale, its rest orientation baked into the inverse bind matrices, so the
// skinned mesh is exactly where it was. This is the shape VRM 0.x required
// (UniVRM normalises on export), and what apps that apply tracking straight
// onto the bones assume; VRM 1.0 allows it. Expressions and morphs are in mesh
// space and do not change; look-at's offsetFromHeadBone is in the head's
// frame, so it is turned into the new one.

import { type Glb, readGlb, writeGlb } from 'tosijs-3d/glb-chunks'

type Json = Record<string, any>
type Mat4 = Float64Array
type Vec3 = [number, number, number]
type Vec4 = [number, number, number, number]

const identity = (): Mat4 => {
  const m = new Float64Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}

/** Column-major a * b. */
function mul(a: ArrayLike<number>, b: ArrayLike<number>): Mat4 {
  const o = new Float64Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!
      o[c * 4 + r] = s
    }
  return o
}

/** A node's local matrix from its TRS (or its matrix). */
function local(node: Json): Mat4 {
  if (Array.isArray(node.matrix)) return Float64Array.from(node.matrix)
  const [x, y, z, w] = (node.rotation as Vec4 | undefined) ?? [0, 0, 0, 1]
  const [sx, sy, sz] = (node.scale as Vec3 | undefined) ?? [1, 1, 1]
  const [tx, ty, tz] = (node.translation as Vec3 | undefined) ?? [0, 0, 0]
  const m = identity()
  m[0] = (1 - 2 * (y * y + z * z)) * sx
  m[1] = 2 * (x * y + z * w) * sx
  m[2] = 2 * (x * z - y * w) * sx
  m[4] = 2 * (x * y - z * w) * sy
  m[5] = (1 - 2 * (x * x + z * z)) * sy
  m[6] = 2 * (y * z + x * w) * sy
  m[8] = 2 * (x * z + y * w) * sz
  m[9] = 2 * (y * z - x * w) * sz
  m[10] = (1 - 2 * (x * x + y * y)) * sz
  m[12] = tx
  m[13] = ty
  m[14] = tz
  return m
}

/** Every node's world matrix at rest. */
export function worldMatrices(json: Json): Mat4[] {
  const nodes = json.nodes as Json[]
  const world: Mat4[] = new Array(nodes.length)
  const walk = (i: number, parent: Mat4) => {
    world[i] = mul(parent, local(nodes[i]!))
    for (const c of (nodes[i]!.children as number[] | undefined) ?? [])
      walk(c, world[i]!)
  }
  const isChild = new Set(nodes.flatMap((n) => (n.children as number[]) ?? []))
  nodes.forEach((_, i) => {
    if (!isChild.has(i)) walk(i, identity())
  })
  return world
}

/** The parts of the bin an accessor's floats live in, as a writable view. */
function floats(g: Glb, accessor: number): Float32Array {
  const a = g.json.accessors[accessor] as Json
  const view = g.json.bufferViews[a.bufferView] as Json
  if (a.componentType !== 5126 || (view.byteStride ?? 0) > 0)
    throw new Error('normalize: inverse bind matrices must be packed floats')
  const start = g.bin!.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return new Float32Array(g.bin!.buffer, start, a.count * 16)
}

/** Whether every joint already rests with no rotation and unit scale. */
export function bonesNormalised(json: Json, eps = 1e-6): boolean {
  const joints = new Set(
    ((json.skins as Json[] | undefined) ?? []).flatMap((s) => s.joints)
  )
  return [...joints].every((j) => {
    const n = json.nodes[j] as Json
    if (Array.isArray(n.matrix)) return false
    const [x, y, z] = (n.rotation as Vec4 | undefined) ?? [0, 0, 0, 1]
    const s = (n.scale as number[] | undefined) ?? [1, 1, 1]
    return (
      Math.abs(x) < eps &&
      Math.abs(y) < eps &&
      Math.abs(z) < eps &&
      s.every((v) => Math.abs(v - 1) < eps)
    )
  })
}

/**
 * The same model with normalised bones. Works on any skinned glTF/VRM whose
 * joints are only ever placed by their parents (no mesh hangs off a joint).
 * The mesh at rest is unchanged: each skin matrix (joint world times inverse
 * bind) is the same before and after.
 */
export function normaliseBones(bytes: Uint8Array): Uint8Array {
  const g = readGlb(bytes.slice())
  const json = g.json
  const nodes = json.nodes as Json[]
  const before = worldMatrices(json)
  const joints = new Set<number>(
    ((json.skins as Json[] | undefined) ?? []).flatMap((s) => s.joints)
  )
  for (const j of joints)
    if (nodes[j]!.mesh !== undefined)
      throw new Error(`normalize: joint ${nodes[j]!.name} carries a mesh`)

  // New locals: a joint keeps only where it is, relative to its parent's
  // new frame (a joint's frame is now its position alone).
  const parent = new Map<number, number>()
  nodes.forEach((n, i) => {
    for (const c of (n.children as number[] | undefined) ?? []) parent.set(c, i)
  })
  const position = (m: Mat4): [number, number, number] => [
    m[12]!,
    m[13]!,
    m[14]!,
  ]
  const newWorld = new Map<number, Mat4>()
  const worldOf = (i: number): Mat4 => {
    if (!joints.has(i)) return before[i]!
    const cached = newWorld.get(i)
    if (cached) return cached
    const m = identity()
    ;[m[12], m[13], m[14]] = position(before[i]!)
    newWorld.set(i, m)
    return m
  }
  for (const j of joints) {
    const p = parent.get(j)
    const pw = p === undefined ? identity() : worldOf(p)
    if (!joints.has(p ?? -1) && p !== undefined) {
      // A joint under a non-joint: its parent keeps its frame, so the local
      // translation is in that frame.
      const inv = invertAffine(pw)
      const t = mul(inv, worldOf(j))
      setTrs(nodes[j]!, [t[12]!, t[13]!, t[14]!])
    } else {
      const a = position(worldOf(j))
      const b = position(pw)
      setTrs(nodes[j]!, [a[0] - b[0], a[1] - b[1], a[2] - b[2]])
    }
  }

  // Inverse bind: new = newWorld^-1 * oldWorld * old, so newWorld * new is unchanged.
  for (const skin of (json.skins as Json[] | undefined) ?? []) {
    if (skin.inverseBindMatrices === undefined)
      throw new Error('normalize: a skin without inverse bind matrices')
    const ibm = floats(g, skin.inverseBindMatrices)
    ;(skin.joints as number[]).forEach((j, k) => {
      const old = ibm.subarray(k * 16, k * 16 + 16)
      const next = mul(invertAffine(worldOf(j)), mul(before[j]!, old))
      ibm.set(next, k * 16)
    })
  }

  // Look-at's offset is in the head's frame: the old head's rotation, now in
  // the new (unrotated) one.
  const vrm = json.extensions?.VRMC_vrm as Json | undefined
  const head = vrm?.humanoid?.humanBones?.head?.node as number | undefined
  const offset = vrm?.lookAt?.offsetFromHeadBone as number[] | undefined
  if (head !== undefined && offset !== undefined) {
    const m = before[head]!
    const [x, y, z] = offset as [number, number, number]
    vrm!.lookAt.offsetFromHeadBone = [
      m[0]! * x + m[4]! * y + m[8]! * z,
      m[1]! * x + m[5]! * y + m[9]! * z,
      m[2]! * x + m[6]! * y + m[10]! * z,
    ].map((v) => Math.round(v * 1e5) / 1e5)
  }
  return writeGlb(json, g.bin)
}

function setTrs(node: Json, translation: [number, number, number]) {
  delete node.matrix
  delete node.rotation
  delete node.scale
  node.translation = translation
}

/** Inverse of an affine column-major matrix (rotation-scale plus translation). */
function invertAffine(m: Mat4): Mat4 {
  const [a, b, c, d, e, f, g, h, i] = [
    m[0]!,
    m[1]!,
    m[2]!,
    m[4]!,
    m[5]!,
    m[6]!,
    m[8]!,
    m[9]!,
    m[10]!,
  ]
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  const r = identity()
  r[0] = A / det
  r[1] = -(b * i - c * h) / det
  r[2] = (b * f - c * e) / det
  r[4] = B / det
  r[5] = (a * i - c * g) / det
  r[6] = -(a * f - c * d) / det
  r[8] = C / det
  r[9] = -(a * h - b * g) / det
  r[10] = (a * e - b * d) / det
  const [tx, ty, tz] = [m[12]!, m[13]!, m[14]!]
  r[12] = -(r[0] * tx + r[4] * ty + r[8] * tz)
  r[13] = -(r[1] * tx + r[5] * ty + r[9] * tz)
  r[14] = -(r[2] * tx + r[6] * ty + r[10] * tz)
  return r
}
