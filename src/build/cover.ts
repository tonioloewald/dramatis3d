// COVERED SKIN, REMOVED. The pure half of tosijs-3d's `coverBody`
// (human-proxy, a Babylon module): the skin a garment lists is dropped where
// it is wholly covered, and what is left under a garment is tucked in along
// its normal so it cannot poke through, faded in from the garment's edge.
// The same rules and numbers as the creator's, so the export is dressed as
// the creator shows it. The right home for this is a pure split of
// human-proxy in tosijs-3d (named in the upstream task).

import { coveredBy, coveredTriangles } from 'tosijs-3d/proxy-fit'
import type { HumanProxy } from 'tosijs-3d/human-pack'

/** Slots whose garment wraps the body (a hat or glasses only sit near it). */
const WRAPS = new Set([
  'outfit',
  'bodysuit',
  'armour',
  'top',
  'bottom',
  'shoes',
  'gloves',
])

export interface Covered {
  /** The skin's triangles less those wholly under a garment that lists them. */
  triangles: Uint32Array
  /** The skin's positions, tucked under what it wears. */
  positions: Float32Array
}

/**
 * The body under what it wears. `positions` and `normals` are the compact
 * skin's (`vertices[i]` is its pack vertex), `triangles` index them;
 * `drawn` holds each worn garment's fitted vertices, by proxy name.
 */
export function coverSkin(
  positions: Float32Array,
  normals: Float32Array,
  triangles: Uint32Array,
  vertices: Uint32Array,
  wearing: readonly HumanProxy[],
  drawn: ReadonlyMap<string, Float32Array>,
  options: { tuck?: number; fade?: number } = {}
): Covered {
  const deleted = new Set<number>()
  // Glasses list skin they do not cover (the lids under the lenses).
  for (const p of wearing)
    if (p.delete !== null && p.slot !== 'glasses')
      for (const v of p.delete) deleted.add(v)
  const tuck = options.tuck ?? 0.006
  const fadeOver = options.fade ?? 0.03
  const n = vertices.length
  const depth = new Float32Array(n)
  for (let i = 0; i < n; i++) if (deleted.has(vertices[i]!)) depth[i] = tuck
  for (const p of wearing) {
    if (p.category !== 'clothes' || !WRAPS.has(p.slot ?? 'outfit')) continue
    const g = drawn.get(p.name)
    if (g === undefined) continue
    const gap = coveredBy(positions, normals, g)
    for (let i = 0; i < n; i++) {
      const d = gap[i]!
      if (d === Infinity) continue
      // Under it by 4 mm, more where it is loose, never more than 10 mm.
      depth[i] = Math.max(depth[i]!, Math.min(0.01, 0.004 + d * 0.3))
    }
  }
  const fade = edgeDistance(triangles, positions, depth, fadeOver)
  const out = Float32Array.from(positions)
  for (let i = 0; i < n; i++) {
    if (depth[i] === 0) continue
    const t = Math.min(1, fade[i]! / fadeOver)
    const d = depth[i]! * t * t * (3 - 2 * t)
    out[i * 3] = out[i * 3]! - normals[i * 3]! * d
    out[i * 3 + 1] = out[i * 3 + 1]! - normals[i * 3 + 1]! * d
    out[i * 3 + 2] = out[i * 3 + 2]! - normals[i * 3 + 2]! * d
  }
  return {
    triangles:
      deleted.size > 0
        ? coveredTriangles(triangles, vertices, deleted, 'all')
        : Uint32Array.from(triangles),
    positions: out,
  }
}

/**
 * For each vertex with `depth > 0`, how far it is along the mesh's edges from
 * the nearest vertex with none, cut off at `limit`.
 */
function edgeDistance(
  triangles: ArrayLike<number>,
  positions: ArrayLike<number>,
  depth: Float32Array,
  limit: number
): Float32Array {
  const n = depth.length
  const dist = new Float32Array(n).fill(Infinity)
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t]!
    const b = triangles[t + 1]!
    const c = triangles[t + 2]!
    adj[a]!.push(b, c)
    adj[b]!.push(a, c)
    adj[c]!.push(a, b)
  }
  const len = (a: number, b: number): number =>
    Math.hypot(
      positions[a * 3]! - positions[b * 3]!,
      positions[a * 3 + 1]! - positions[b * 3 + 1]!,
      positions[a * 3 + 2]! - positions[b * 3 + 2]!
    )
  let frontier: number[] = []
  for (let v = 0; v < n; v++)
    if (depth[v] === 0) {
      dist[v] = 0
      frontier.push(v)
    }
  while (frontier.length > 0) {
    const next: number[] = []
    for (const v of frontier)
      for (const u of adj[v]!) {
        const d = dist[v]! + len(v, u)
        if (d < dist[u]! && d <= limit) {
          dist[u] = d
          next.push(u)
        }
      }
    frontier = next
  }
  return dist
}
