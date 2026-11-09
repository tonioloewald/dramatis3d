// A HELD ITEM as GLB parts for any skeleton (#3909): the socket joint under
// the hand and the item's mesh, skinned wholly to it, with its materials and
// pictures. Bound for tosijs-3d (upstream:tosijs-3d, #3917): riggedBodyGlb
// does the same inside itself (its heldSocket and materialsOf are private),
// and Dramatis's MakeHuman writer needs it for a skeleton riggedBodyGlb
// didn't make. The math is the same as riggedBodyGlb's, so an item sits in
// the same place on either path: the hand's socket (hand-socket's
// socketWorld, in Babylon's mirrored frame, as the character builder shows
// it) times the grip, mirrored back into glTF's frame.
//
// Public subpaths only (src/upstream/README.md): it moves without edits.

import {
  gripMatrix,
  gripPoint,
  mat4Multiply,
  socketWorld,
  type Grip,
  type Vec3,
} from 'tosijs-3d/hand-socket'
import type { GltfSurfaceMaterial } from 'tosijs-3d/glb-rig'
import type { BodyTriangles } from 'tosijs-3d/rigged-body'
import type {
  GlbImage,
  GlbMaterial,
  GlbMesh,
  GlbQuat,
  GlbVec3,
} from 'tosijs-3d/skinned-glb'

type V3 = [number, number, number]
type Q = [number, number, number, number]

/** A skeleton's joint at rest: local transform and model-space position. */
export interface RestJoint {
  name: string
  parent: number
  translation: GlbVec3
  rotation: GlbQuat
  position: GlbVec3
}

/** What a hand holds (riggedBodyGlb's `HeldItem`, the same fields). */
export interface HeldPartsItem {
  grip: Grip
  side?: 'r' | 'l'
  /** The socket joint's name (default `weapon_r` or `weapon_l`). */
  name?: string
  /** The item, in its own frame; left out, the socket alone. */
  item?: BodyTriangles
  /** Where the item is held, in its frame (default `gripPoint` of it). */
  gripPoint?: Vec3
  /** The item mesh's `extras` (its licence). */
  extras?: Record<string, unknown>
}

/** The parts: append the joint to the skeleton, the mesh and the rest to the file. */
export interface HeldParts {
  joint: {
    name: string
    parent: number
    translation: V3
    rotation: Q
    /** 16 numbers, column-major. */
    inverseBind: Float32Array
  }
  /** The item's mesh, skinned to the joint at `jointIndex`; null for a socket alone. */
  mesh: GlbMesh | null
  /** Its materials, to append to the file's (the mesh's indices count from `materialBase`). */
  materials: GlbMaterial[]
  /** Its pictures, to append to the file's (the materials count from `imageBase`). */
  images: GlbImage[]
}

const qmul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const qconj = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]]
const qnorm = (q: Q): Q => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}
const qrot = (q: Q, v: V3): V3 => {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q))
  return [p[0], p[1], p[2]]
}
/** A row-major 3×3 rotation as a quaternion. */
function matrixQuat(m: number[]): Q {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ]
  const tr = m00 + m11 + m22
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    return qnorm([(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4])
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    return qnorm([s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s])
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    return qnorm([(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s])
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2
  return qnorm([(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s])
}

/** Each joint's model-space rotation at rest. */
function worldRotations(joints: readonly RestJoint[]): Q[] {
  const out: Q[] = []
  joints.forEach((j, i) => {
    const r = [...j.rotation] as Q
    out[i] = j.parent < 0 ? r : qnorm(qmul(out[j.parent]!, r))
  })
  return out
}

/** Smooth vertex normals, area-weighted. */
function smoothNormals(
  pos: Float32Array,
  indices: ArrayLike<number>
): Float32Array {
  const n = new Float32Array(pos.length)
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t]! * 3
    const b = indices[t + 1]! * 3
    const c = indices[t + 2]! * 3
    const ux = pos[b]! - pos[a]!
    const uy = pos[b + 1]! - pos[a + 1]!
    const uz = pos[b + 2]! - pos[a + 2]!
    const vx = pos[c]! - pos[a]!
    const vy = pos[c + 1]! - pos[a + 1]!
    const vz = pos[c + 2]! - pos[a + 2]!
    const x = uy * vz - uz * vy
    const y = uz * vx - ux * vz
    const z = ux * vy - uy * vx
    for (const k of [a, b, c]) {
      n[k] = n[k]! + x
      n[k + 1] = n[k + 1]! + y
      n[k + 2] = n[k + 2]! + z
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i]!, n[i + 1]!, n[i + 2]!)
    if (l > 0) {
      n[i] = n[i]! / l
      n[i + 1] = n[i + 1]! / l
      n[i + 2] = n[i + 2]! / l
    } else n[i + 1] = 1
  }
  return n
}

const isGltfMaterial = (m: unknown): m is GltfSurfaceMaterial =>
  m != null &&
  typeof m === 'object' &&
  Array.isArray((m as GltfSurfaceMaterial).baseColorFactor)

/** The item's surfaces as GLB materials, their pictures each once. */
function itemMaterials(
  item: BodyTriangles,
  runs: number,
  imageBase: number
): { materials: GlbMaterial[]; images: GlbImage[] } {
  const images: GlbImage[] = []
  const seen = new Map<Uint8Array, number>()
  const textured = item.uvs != null
  const image = (
    t: GltfSurfaceMaterial['baseColorTexture'],
    name: string
  ): { image: number } | undefined => {
    if (!textured || t?.bytes == null) return undefined
    if (t.mimeType !== 'image/png' && t.mimeType !== 'image/jpeg')
      return undefined
    let i = seen.get(t.bytes)
    if (i == null) {
      images.push({ name, mimeType: t.mimeType, bytes: t.bytes })
      i = images.length - 1
      seen.set(t.bytes, i)
    }
    return { image: imageBase + i }
  }
  const materials: GlbMaterial[] = []
  for (let s = 0; s < runs; s++) {
    const name = s === 0 ? 'held' : `held_${s + 1}`
    const m = item.surfaces?.[s]?.material
    if (!isGltfMaterial(m)) {
      materials.push({
        name,
        baseColorFactor: [0.8, 0.8, 0.8, 1],
        metallicFactor: 0,
        roughnessFactor: 0.8,
        alphaMode: 'OPAQUE',
        doubleSided: false,
      })
      continue
    }
    const out: GlbMaterial = {
      name,
      baseColorFactor: m.baseColorFactor,
      metallicFactor: m.metallicFactor,
      roughnessFactor: m.roughnessFactor,
      alphaMode: m.alphaMode,
      ...(m.alphaMode === 'MASK' ? { alphaCutoff: m.alphaCutoff } : {}),
      doubleSided: m.doubleSided,
    }
    const base = image(m.baseColorTexture, `${name}_baseColor`)
    if (base) out.baseColorTexture = base
    const mr = image(m.metallicRoughnessTexture, `${name}_metallicRoughness`)
    if (mr) out.metallicRoughnessTexture = mr
    const normal = image(m.normalTexture, `${name}_normal`)
    if (normal) out.normalTexture = { ...normal, scale: m.normalTexture!.scale }
    const occ = image(m.occlusionTexture, `${name}_occlusion`)
    if (occ)
      out.occlusionTexture = { ...occ, strength: m.occlusionTexture!.strength }
    if (m.emissiveFactor.some((x) => x > 0))
      out.emissiveFactor = m.emissiveFactor
    const em = image(m.emissiveTexture, `${name}_emissive`)
    if (em) out.emissiveTexture = em
    materials.push(out)
  }
  return { materials, images }
}

/**
 * The held item's parts for a skeleton at rest: its socket joint (appended
 * after the skeleton's, parented to the hand) and, with `held.item`, the
 * mesh skinned to it, its materials (indices from `materialBase`) and
 * pictures (from `imageBase`). Throws when the hand can't be read.
 */
export function heldParts(
  joints: readonly RestJoint[],
  held: HeldPartsItem,
  bases: { materialBase: number; imageBase: number }
): HeldParts {
  const side = held.side ?? 'r'
  const ix = (n: string) => {
    const i = joints.findIndex((j) => j.name === n)
    if (i < 0) throw new Error(`held: needs ${n}, not in the skeleton`)
    return i
  }
  const hand = ix(`hand_${side}`)
  const mirror = (p: GlbVec3): Vec3 => ({ x: -p[0], y: p[1], z: p[2] })
  const socket = socketWorld(
    side,
    mirror(joints[hand]!.position),
    mirror(joints[ix(`lowerarm_${side}`)]!.position),
    mirror(joints[ix(`thumb_01_${side}`)]!.position)
  )
  if (socket == null)
    throw new Error(
      `held: the ${side} hand cannot be read (thumb in line with the forearm)`
    )
  // Into glTF's frame again: x negated in every row (the socket's mirror,
  // a reflection, cancels Babylon's; riggedBodyGlb's heldSocket does this).
  const w = mat4Multiply(gripMatrix(held.grip), socket)
  const f = w.map((v, k) => (k % 4 === 0 ? -v : v))
  const axis = (i: number): V3 => {
    const l = Math.hypot(f[i * 4]!, f[i * 4 + 1]!, f[i * 4 + 2]!) || 1
    return [f[i * 4]! / l, f[i * 4 + 1]! / l, f[i * 4 + 2]! / l]
  }
  const [ax, ay, az] = [axis(0), axis(1), axis(2)]
  const rotation = matrixQuat([
    ax[0],
    ay[0],
    az[0],
    ax[1],
    ay[1],
    az[1],
    ax[2],
    ay[2],
    az[2],
  ])
  const position: V3 = [f[12]!, f[13]!, f[14]!]
  const handQ = worldRotations(joints)[hand]!
  const hp = joints[hand]!.position
  const local = qrot(qconj(handQ), [
    position[0] - hp[0],
    position[1] - hp[1],
    position[2] - hp[2],
  ])
  const r = qconj(rotation)
  const t = qrot(r, position)
  // Column-major R^T, then -R^T·p.
  const rx = qrot(r, [1, 0, 0])
  const ry = qrot(r, [0, 1, 0])
  const rz = qrot(r, [0, 0, 1])
  const inverseBind = Float32Array.from([
    ...rx,
    0,
    ...ry,
    0,
    ...rz,
    0,
    -t[0],
    -t[1],
    -t[2],
    1,
  ])
  const joint = {
    name: held.name ?? `weapon_${side}`,
    parent: hand,
    translation: local,
    rotation: qnorm(qmul(qconj(handQ), rotation)),
    inverseBind,
  }
  const item = held.item
  if (!item) return { joint, mesh: null, materials: [], images: [] }

  const gp = held.gripPoint ?? gripPoint(item.positions) ?? { x: 0, y: 0, z: 0 }
  const k = held.grip.scale ?? 1
  const pos = new Float32Array(item.positions.length)
  for (let i = 0; i < pos.length; i += 3) {
    const v = qrot(rotation, [
      (item.positions[i]! - gp.x) * k,
      (item.positions[i + 1]! - gp.y) * k,
      (item.positions[i + 2]! - gp.z) * k,
    ])
    pos[i] = position[0] + v[0]
    pos[i + 1] = position[1] + v[1]
    pos[i + 2] = position[2] + v[2]
  }
  const runs: Array<[number, number]> = item.surfaces?.length
    ? item.surfaces.map((s) => [s.start, s.count])
    : [[0, item.indices.length]]
  const { materials, images } = itemMaterials(
    item,
    runs.length,
    bases.imageBase
  )
  const jointIndex = joints.length
  const normals = smoothNormals(pos, item.indices)
  const uvs = item.uvs ? Float32Array.from(item.uvs) : null
  const mesh: GlbMesh = {
    name: 'held',
    primitives: runs.map(([start, count], s) => {
      // Each run's own vertices, re-indexed from 0.
      const used = new Map<number, number>()
      const tri: number[] = []
      for (let i = start; i < start + count; i++) {
        const v = item.indices[i]!
        let u = used.get(v)
        if (u == null) {
          u = used.size
          used.set(v, u)
        }
        tri.push(u)
      }
      const pick = (src: ArrayLike<number>, width: number) => {
        const out = new Float32Array(used.size * width)
        for (const [v, u] of used)
          for (let c = 0; c < width; c++)
            out[u * width + c] = src[v * width + c]!
        return out
      }
      const js = new Uint16Array(used.size * 4).fill(0)
      const ws = new Float32Array(used.size * 4)
      for (let u = 0; u < used.size; u++) {
        js[u * 4] = jointIndex
        ws[u * 4] = 1
      }
      return {
        positions: pick(pos, 3),
        normals: pick(normals, 3),
        uvs: uvs ? pick(uvs, 2) : null,
        joints: js,
        weights: ws,
        indices: Uint32Array.from(tri),
        material: bases.materialBase + s,
      }
    }),
    ...(held.extras ? { extras: held.extras } : {}),
  }
  return { joint, mesh, materials, images }
}
