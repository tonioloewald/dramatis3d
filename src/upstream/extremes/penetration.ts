/*
PENETRATION: how much of a garment (or hair) lies inside the body.

Two measures, both per fitted vertex:

- RAW: the vertex is inside the bare skin by more than `tolerance`. This is
  the geometric fact, whatever the renderer hides.
- VISIBLE: the vertex is inside the skin deeper than the skin is tucked
  there, so the skin would show through the cloth. The creator hides skin
  under clothes (tosijs-3d's `coverBody`): triangles whose three vertices a
  garment lists as covered are dropped, listed vertices are drawn in by 6
  mm, and skin a wrapping garment covers by geometry by 4 to 10 mm. This
  module reproduces those depths per vertex (without coverBody's fade at
  the edge of the covered patch, so it is slightly generous there), and
  takes the shallowest of the nearest triangle's three as the tuck there.

Pure; positions in the pack's frame (metres).
*/

import { coveredBy } from 'tosijs-3d/proxy-fit'
import type { MeshSdf } from './inside'

/** coverBody's tuck for listed (deleted) skin, metres. */
export const LISTED_TUCK = 0.006
/** Slots whose garments wrap the body, so coverBody tucks what they cover. */
export const WRAPPING_SLOTS: readonly string[] = [
  'outfit',
  'bodysuit',
  'armour',
  'top',
  'bottom',
  'shoes',
  'gloves',
]

export interface Penetration {
  /** Vertices tested. */
  vertices: number
  /** Inside the bare skin by more than the tolerance. */
  raw: number
  /** Deepest raw penetration, metres (0 when none). */
  rawDepth: number
  /** Inside deeper than the skin is tucked there. */
  visible: number
  /** Deepest visible penetration (beyond the tuck), metres. */
  visibleDepth: number
  /** Visible vertices deeper than 2, 5 and 10 mm beyond the tuck. */
  visibleBeyond: [number, number, number]
  /** Indices (vertex numbers) of the visible ones, at most `keep`. */
  worst: number[]
}

export interface PenetrationOptions {
  /** Ignore penetration shallower than this (metres). */
  tolerance?: number
  /** Distances beyond this are classified only (see MeshSdf). */
  cap?: number
  /** How many of the worst vertices to keep. */
  keep?: number
}

/**
 * How deep the creator tucks each body vertex under a garment: Infinity
 * where coverBody drops the triangles (see `triangleTuck`), else metres.
 * `positions`, `normals`: every pack vertex; `drawn`: the garment as fitted.
 */
export function tuckDepths(
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  garment: { delete: Uint32Array | null; slot?: string; category: string },
  drawn: ArrayLike<number>
): Float32Array {
  const n = positions.length / 3
  const depth = new Float32Array(n)
  if (garment.delete && garment.slot !== 'glasses')
    for (const v of garment.delete) depth[v]! = LISTED_TUCK
  if (
    garment.category === 'clothes' &&
    WRAPPING_SLOTS.includes(garment.slot ?? 'outfit')
  ) {
    const gap = coveredBy(positions, normals, drawn)
    for (let i = 0; i < n; i++) {
      if (gap[i]! === Infinity) continue
      depth[i]! = Math.max(depth[i]!, Math.min(0.01, 0.004 + gap[i]! * 0.3))
    }
  }
  return depth
}

/**
 * Per body triangle, how deep the skin there is tucked: Infinity when all
 * three of its vertices are listed as covered (coverBody drops it), else
 * the shallowest of its vertices' tucks.
 */
export function triangleTuck(
  triangles: ArrayLike<number>,
  depth: Float32Array,
  deleted: Uint32Array | null
): Float32Array {
  const nt = triangles.length / 3
  const out = new Float32Array(nt)
  const del = new Uint8Array(depth.length)
  if (deleted) for (const v of deleted) del[v]! = 1
  for (let t = 0; t < nt; t++) {
    const a = triangles[t * 3]!
    const b = triangles[t * 3 + 1]!
    const c = triangles[t * 3 + 2]!
    out[t]! =
      del[a]! && del[b]! && del[c]!
        ? Infinity
        : Math.min(depth[a]!, depth[b]!, depth[c]!)
  }
  return out
}

/** Per point, 1 where it is visibly inside (as `penetration` counts it). */
export function visibleMask(
  sdf: MeshSdf,
  points: ArrayLike<number>,
  tuck: Float32Array | null,
  options: PenetrationOptions = {}
): Uint8Array {
  const tol = options.tolerance ?? 0.001
  const cap = options.cap ?? 0.03
  const n = Math.floor(points.length / 3)
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const { distance, triangle } = sdf.nearest(
      points[i * 3]!,
      points[i * 3 + 1]!,
      points[i * 3 + 2]!,
      cap
    )
    if (distance >= -tol) continue
    const t = triangle >= 0 && tuck ? tuck[triangle]! : 0
    if (-distance - t > tol) out[i]! = 1
  }
  return out
}

/**
 * Penetration of `points` (xyz) into the body `sdf`. `tuck` is per body
 * triangle (from `triangleTuck`); without it, visible equals raw.
 */
export function penetration(
  sdf: MeshSdf,
  points: ArrayLike<number>,
  tuck: Float32Array | null,
  options: PenetrationOptions = {}
): Penetration {
  const tol = options.tolerance ?? 0.001
  const cap = options.cap ?? 0.03
  const keep = options.keep ?? 8
  const n = Math.floor(points.length / 3)
  let raw = 0
  let rawDepth = 0
  let visible = 0
  let visibleDepth = 0
  const visibleBeyond: [number, number, number] = [0, 0, 0]
  const worst: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    const { distance, triangle } = sdf.nearest(
      points[i * 3]!,
      points[i * 3 + 1]!,
      points[i * 3 + 2]!,
      cap
    )
    if (distance >= -tol) continue
    raw++
    rawDepth = Math.max(rawDepth, -distance)
    // Deeper than the cap: no triangle was found, and nothing tucks that deep.
    const t = triangle >= 0 && tuck ? tuck[triangle]! : 0
    const beyond = -distance - t
    if (beyond > tol) {
      visible++
      visibleDepth = Math.max(visibleDepth, beyond)
      if (beyond > 0.002) visibleBeyond[0]++
      if (beyond > 0.005) visibleBeyond[1]++
      if (beyond > 0.01) visibleBeyond[2]++
      worst.push([beyond, i])
    }
  }
  worst.sort((a, b) => b[0]! - a[0]!)
  return {
    vertices: n,
    raw,
    rawDepth,
    visible,
    visibleDepth,
    visibleBeyond,
    worst: worst.slice(0, keep).map(([, i]) => i),
  }
}
