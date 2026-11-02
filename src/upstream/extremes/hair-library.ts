/*
QUATERNIUS' HAIR, PLACED WITHOUT AN ENGINE.

tosijs-3d's creator wears Quaternius' CC0 hairstyles through `human-hair`:
`loadHairLibrary` reads the GLB, `headScalp` measures the body's head, and
`placeHair` carries a piece from the head it was modelled on to this one
with `hair-fit` (shellWarp, applyWarp, keepHeight, conformOutside). Those
three live in a module that imports Babylon (for the loading and the mesh),
so the sweep cannot import them. This file is their geometry, engine-free,
step for step the same, so the sweep places hair exactly as the creator
does. It is the strongest argument for the upstream move: in tosijs-3d,
split the pure half of `human-hair` (headScalp, placeHair, the head
choice and QUATERNIUS_HEADS) into its own pure subpath, have the sweep
import it there, and delete this copy.

What is left out: brows (`centreY`), the slider nudge (zero at the
defaults), and the brow pieces' lash strips (brows are not swept from this
library; MakeHuman's brows are).
*/

import { accessorValues, readGlb } from '../glb/glb-chunks'
import { humanJoint } from 'tosijs-3d/human-morph'
import type { HumanPackManifest } from 'tosijs-3d/human-pack'
import {
  applyWarp,
  conformOutside,
  headRegion,
  headRegionIndices,
  keepHeight,
  pick,
  shellWarp,
  skinGaps,
  vertexNormals,
  type HeadLandmarks,
  type ShellWarp,
} from 'tosijs-3d/hair-fit'

export interface HairPart {
  positions: Float32Array
  indices: Uint32Array
}

export interface HairPiece {
  name: string
  category: string
  parts: HairPart[]
}

export interface ReferenceHead {
  name: string
  skin: Float32Array
  normals: Float32Array
  landmarks: HeadLandmarks
  /** The lower edge of its moustache, when the library has one. */
  lip?: { y: number; z: number }
}

/** Quaternius' two adult heads and their eyes (tosijs-3d's QUATERNIUS_HEADS). */
export const REFERENCE_HEADS: Readonly<Record<string, HeadLandmarks>> =
  Object.freeze({
    Reference_Head_Male: {
      eyeY: 1.6986,
      eyeZ: 0.0659,
      midX: 0,
      spacing: 0.0676,
    },
    Reference_Head_Female: {
      eyeY: 1.656,
      eyeZ: 0.0591,
      midX: 0,
      spacing: 0.069,
    },
  })

/** Pieces that grow on the face, not the scalp. */
export const FACIAL = /Beard|Moustache|Mustache|MuttonChops|Goatee|Stubble/i

// --- A GLB's meshes in the file's frame (only what the library uses). ---

type Mat4 = number[]
const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const mul = (a: Mat4, b: Mat4): Mat4 => {
  const o = new Array<number>(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!
  return o
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const local = (n: any): Mat4 => {
  if (Array.isArray(n.matrix)) return n.matrix
  const [tx, ty, tz] = n.translation ?? [0, 0, 0]
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = n.scale ?? [1, 1, 1]
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ]
}

/** Read a hair library GLB: each top-level node a piece (its extras' category). */
export function readHairLibrary(bytes: Uint8Array): HairPiece[] {
  const glb = readGlb(bytes)
  if (glb.bin === null) throw new Error('hair library: no binary chunk')
  const json = glb.json
  const accessor = (i: number): Float64Array => accessorValues(glb, i)
  const pieces: HairPiece[] = []
  const scene = json.scenes[json.scene ?? 0]
  for (const top of scene.nodes as number[]) {
    const node = json.nodes[top]
    const extras = node.extras ?? {}
    const category =
      extras.category ??
      (String(node.name).startsWith('Eyebrows') ? 'eyebrows' : 'hair')
    const parts: HairPart[] = []
    const visit = (i: number, parent: Mat4) => {
      const n = json.nodes[i]
      const world = mul(parent, local(n))
      if (n.mesh != null)
        for (const prim of json.meshes[n.mesh].primitives) {
          if (prim.attributes?.POSITION == null) continue
          const raw = accessor(prim.attributes.POSITION)
          const positions = new Float32Array(raw.length)
          for (let k = 0; k < raw.length; k += 3) {
            const x = raw[k]!
            const y = raw[k + 1]!
            const z = raw[k + 2]!
            positions[k]! =
              world[0]! * x + world[4]! * y + world[8]! * z + world[12]!
            positions[k + 1]! =
              world[1]! * x + world[5]! * y + world[9]! * z + world[13]!
            positions[k + 2]! =
              world[2]! * x + world[6]! * y + world[10]! * z + world[14]!
          }
          const indices =
            prim.indices != null
              ? Uint32Array.from(accessor(prim.indices))
              : Uint32Array.from({ length: raw.length / 3 }, (_, k) => k)
          if (positions.length > 0) parts.push({ positions, indices })
        }
      for (const c of n.children ?? []) visit(c, world)
    }
    visit(top, IDENTITY)
    if (parts.length > 0) pieces.push({ name: node.name, category, parts })
  }
  return pieces
}

/** The library's reference heads, with the moustache's lip line on its own head. */
export function referenceHeads(pieces: HairPiece[]): ReferenceHead[] {
  const heads: ReferenceHead[] = []
  for (const [name, landmarks] of Object.entries(REFERENCE_HEADS)) {
    const p = pieces.find((x) => x.name === name)
    if (!p) continue
    const part = p.parts[0]!
    heads.push({
      name,
      skin: part.positions,
      normals: vertexNormals(part.positions, part.indices),
      landmarks,
    })
  }
  if (heads.length === 0) throw new Error('hair library: no reference head')
  return heads
}

/** Which head a piece hugs (tosijs-3d's `hug`): lower is closer. */
function hug(parts: HairPart[], head: ReferenceHead): number {
  const sample: number[] = []
  for (const p of parts) {
    const n = p.positions.length / 3
    const step = Math.max(1, Math.floor(n / 300))
    for (let i = 0; i < n; i += step)
      sample.push(
        p.positions[i * 3]!,
        p.positions[i * 3 + 1]!,
        p.positions[i * 3 + 2]!
      )
  }
  const g = Array.from(skinGaps(sample, head.skin, head.normals))
  const inside = g.filter((x) => x < -0.005).length / g.length
  const near = g
    .map(Math.abs)
    .sort((x, y) => x - y)
    .slice(0, Math.ceil(g.length / 2))
  return near.reduce((x, y) => x + y, 0) / near.length + 0.02 * inside
}

export function headFor(
  piece: HairPiece,
  heads: ReferenceHead[]
): ReferenceHead {
  let best = heads[0]
  let score = Infinity
  for (const h of heads) {
    const s = hug(piece.parts, h)
    if (s < score) {
      score = s
      best = h
    }
  }
  return best!
}

/** Set each head's lip line from the library's moustache (tosijs-3d does the same). */
export function markLips(
  pieces: HairPiece[],
  heads: ReferenceHead[],
  name = 'Hair_Moustache'
) {
  const m = pieces.find((p) => p.name === name)?.parts[0]
  if (!m) return
  let lo = Infinity
  let z = 0
  for (const v of m.indices)
    if (Math.abs(m.positions[v * 3]!) < 0.01 && m.positions[v * 3 + 1]! < lo) {
      lo = m.positions[v * 3 + 1]!
      z = m.positions[v * 3 + 2]!
    }
  if (lo < Infinity)
    headFor(pieces.find((p) => p.name === name)!, heads).lip = { y: lo, z }
}

export interface BodyHead {
  skin: Float32Array
  normals: Float32Array
  landmarks: HeadLandmarks
  centre: { x: number; y: number; z: number }
  lipTop: number | null
  warp(head: ReferenceHead, region: 'scalp' | 'face'): ShellWarp
}

/** A morphed body's head (tosijs-3d's `headScalp`). */
export function bodyHead(
  manifest: HumanPackManifest,
  positions: ArrayLike<number>,
  triangles: ArrayLike<number>,
  lips: ArrayLike<number> | null
): BodyHead {
  const [lx, ly, lz] = humanJoint(positions, manifest.joints['eye.L____head']!)
  const [rx] = humanJoint(positions, manifest.joints['eye.R____head']!)
  const at: HeadLandmarks = {
    eyeY: ly,
    eyeZ: lz,
    midX: (lx + rx) / 2,
    spacing: Math.abs(lx - rx),
  }
  const normals = vertexNormals(positions, triangles)
  const used = new Uint8Array(positions.length / 3)
  for (let i = 0; i < triangles.length; i++) used[triangles[i]!] = 1
  const skin: number[] = []
  const skinN: number[] = []
  const e = at.spacing
  for (let v = 0; v < used.length; v++) {
    if (!used[v]!) continue
    const x = positions[v * 3]!
    const y = positions[v * 3 + 1]!
    if (y < ly - 2.8 * e || Math.abs(x - at.midX) > 1.6 * e) continue
    skin.push(x, y, positions[v * 3 + 2]!)
    skinN.push(normals[v * 3]!, normals[v * 3 + 1]!, normals[v * 3 + 2]!)
  }
  const mine = Float32Array.from(skin)
  const skinNormals = Float32Array.from(skinN)
  let lipTop: number | null = null
  if (lips) {
    let top = -Infinity
    for (let v = 0; v < lips.length; v++)
      if (lips[v]! > 0.5) top = Math.max(top, positions[v * 3 + 1]!)
    lipTop = top > -Infinity ? top : null
  }
  const warps = new Map<string, ShellWarp>()
  return {
    skin: mine,
    normals: skinNormals,
    landmarks: at,
    centre: { x: at.midX, y: ly + 0.5 * e, z: lz - 1.2 * e },
    lipTop,
    warp(head, region) {
      const key = `${head.name}:${region}`
      let w = warps.get(key)
      if (w == null) {
        const ix = headRegionIndices(mine, at, region)
        w = shellWarp(
          headRegion(head.skin, head.landmarks, region),
          pick(mine, ix),
          {
            normals: pick(skinNormals, ix),
            clearance: region === 'scalp' ? 0.002 : 0.0005,
          }
        )
        warps.set(key, w)
      }
      return w
    },
  }
}

const gapCache = new WeakMap<HairPart, Map<ReferenceHead, Float32Array>>()

/** A part placed on a body's head (tosijs-3d's `placeHair`, no brow centring or nudge). */
export function placeHairPart(
  body: BodyHead,
  part: HairPart,
  head: ReferenceHead,
  on: 'scalp' | 'face'
): Float32Array {
  const p = applyWarp(part.positions, body.warp(head, on))
  let byHead = gapCache.get(part)
  if (byHead == null) gapCache.set(part, (byHead = new Map()))
  let gaps = byHead.get(head)
  if (gaps == null)
    byHead.set(head, (gaps = skinGaps(part.positions, head.skin, head.normals)))
  keepHeight(p, gaps, body.skin, body.normals, {
    clearance: on === 'face' ? 0.0005 : 0.002,
  })
  const lip = head.lip
  if (on === 'face' && lip != null && body.lipTop != null) {
    const landed = applyWarp([0, lip.y, lip.z], body.warp(head, 'face'))
    const dy = body.lipTop + 0.004 - landed[1]!
    for (let v = 0; v < p.length; v += 3) {
      const t = (part.positions[v + 1]! - lip.y) / 0.02
      p[v + 1]! += dy * Math.exp(-t * t)
    }
  }
  conformOutside(p, body.skin, body.normals, 0.002)
  return p
}
