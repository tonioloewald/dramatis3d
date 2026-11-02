// VRM 1.0 export: a profile GLB plus `VRMC_vrm` (site/docs/export-format.md,
// "What VRM adds"; this lane's page is site/docs/vrm.md).
//
// The VRM is the GLB export with one more extension in its JSON. The binary
// chunk is the GLB writer's, untouched, so geometry, skin, morphs, materials
// and licences are exactly what the GLB export carries; VRM only names
// things in it: which joint is which human bone, which face units make which
// expression, where the eyes are, and the licence terms in VRM's own words.

import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack } from 'tosijs-3d/human-pack'
import { buildCharacter, writeCharacterGlb } from '../build'
import type { BuiltCharacter } from '../contracts/built-character'
import type { VrmExportOptions, VrmMeta } from '../contracts/export'
import type { LicenceEntry } from '../contracts/licences'
import {
  EXTRAS_KEY,
  type ExportExtras,
  type FaceUnitName,
} from '../contracts/profile'
import { LOOK_PRESETS, VRM_PRESETS, type VrmPresetName } from './expressions'
import {
  type Glb,
  readGlb,
  readVec3,
  writeGlb,
} from '../upstream/glb/glb-chunks'
import { VRM_HUMAN_BONES } from './humanoid'
import { VRM_LICENSE_URL, VRMC_VRM } from './spec'

/** Where every asset's licence is listed, for `meta.otherLicenseUrl`. */
export const LICENCES_PAGE_URL = 'https://dramatis.tosijs.net/licences/'

/** The creator, the default `meta.contactInformation`. */
export const CREATOR_URL = 'https://dramatis.tosijs.net/creator/'

/** The default `meta.authors`. */
export const DEFAULT_AUTHORS: readonly string[] = Object.freeze([
  'Dramatis user',
])

type Json = Record<string, unknown>
type Mat4 = Float64Array

function compose(t: readonly number[], q: readonly number[]): Mat4 {
  const [x, y, z, w] = q as [number, number, number, number]
  const m = new Float64Array(16)
  m[0] = 1 - 2 * (y * y + z * z)
  m[1] = 2 * (x * y + z * w)
  m[2] = 2 * (x * z - y * w)
  m[4] = 2 * (x * y - z * w)
  m[5] = 1 - 2 * (x * x + z * z)
  m[6] = 2 * (y * z + x * w)
  m[8] = 2 * (x * z + y * w)
  m[9] = 2 * (y * z - x * w)
  m[10] = 1 - 2 * (x * x + y * y)
  m[12] = t[0]!
  m[13] = t[1]!
  m[14] = t[2]!
  m[15] = 1
  return m
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float64Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!
      out[c * 4 + r] = s
    }
  return out
}

/** A point into a rigid transform's local frame (rotation and translation only). */
function toLocal(m: Mat4, p: readonly number[]): [number, number, number] {
  const d = [p[0]! - m[12]!, p[1]! - m[13]!, p[2]! - m[14]!]
  // The inverse of a rotation is its transpose: dot with each column.
  return [0, 1, 2].map(
    (c) => m[c * 4]! * d[0]! + m[c * 4 + 1]! * d[1]! + m[c * 4 + 2]! * d[2]!
  ) as [number, number, number]
}

/** Each node's world matrix, in the scene's rest pose. */
function worldMatrices(json: Json): Mat4[] {
  const nodes = (json.nodes ?? []) as Array<{
    translation?: number[]
    rotation?: number[]
    children?: number[]
  }>
  const parent = new Map<number, number>()
  nodes.forEach((n, i) => n.children?.forEach((c) => parent.set(c, i)))
  const out: Array<Mat4 | undefined> = []
  const at = (i: number): Mat4 => {
    const have = out[i]
    if (have !== undefined) return have
    const n = nodes[i]!
    const local = compose(
      n.translation ?? [0, 0, 0],
      n.rotation ?? [0, 0, 0, 1]
    )
    const p = parent.get(i)
    const w = p === undefined ? local : multiply(at(p), local)
    out[i] = w
    return w
  }
  return nodes.map((_, i) => at(i))
}

interface MeshNode {
  node: number
  name: string
  mesh: number
  targetNames: string[]
}

function meshNodes(json: Json): MeshNode[] {
  const nodes = (json.nodes ?? []) as Array<{ name?: string; mesh?: number }>
  const meshes = (json.meshes ?? []) as Array<{
    extras?: { targetNames?: unknown }
  }>
  return nodes.flatMap((n, node) => {
    if (n.mesh === undefined) return []
    const names = meshes[n.mesh]?.extras?.targetNames
    return [
      {
        node,
        name: n.name ?? '',
        mesh: n.mesh,
        targetNames: Array.isArray(names) ? (names as string[]) : [],
      },
    ]
  })
}

/** `expressions.preset`: each preset's units bound on every mesh that carries them. */
export function vrmExpressions(json: Json): Record<string, Json> {
  const meshes = meshNodes(json)
  const preset: Record<string, Json> = {}
  for (const p of VRM_PRESETS) {
    const binds: Json[] = []
    for (const [unit, weight] of p.units)
      for (const m of meshes) {
        const index = m.targetNames.indexOf(unit)
        if (index >= 0) binds.push({ node: m.node, index, weight })
      }
    if (binds.length === 0) continue
    preset[p.name] = {
      morphTargetBinds: binds,
      isBinary: false,
      overrideBlink: p.overrideBlink ?? 'none',
      overrideLookAt: p.overrideLookAt ?? 'none',
      overrideMouth: p.overrideMouth ?? 'none',
    }
  }
  return preset
}

/** What the look-at measured on the eyes: where they are, how far a unit turns them. */
export interface EyeMeasure {
  /** The point between the eye centres, model space (metres). */
  centre: [number, number, number]
  /** Degrees a look preset turns the eyes at weight 1 (mean of the two eyes). */
  turn: Partial<Record<VrmPresetName, number>>
}

/**
 * Measure the eyes of a profile GLB: each eyeball's centre (the middle of
 * its vertices' bounds, split at x = 0) and, per look preset, the angle its
 * units turn the eye's most-moved vertex about that centre at weight 1.
 * Undefined when the file has no `eyes` mesh.
 */
export function measureEyes(g: Glb): EyeMeasure | undefined {
  const node = meshNodes(g.json).find((m) => m.name === 'eyes')
  if (node === undefined) return undefined
  const prim = g.json.meshes[node.mesh].primitives[0]
  const pos = readVec3(g, prim.attributes.POSITION)
  const n = pos.length / 3
  const side = (v: number): 'l' | 'r' => (pos[v * 3]! > 0 ? 'l' : 'r')
  const centres = { l: [0, 0, 0], r: [0, 0, 0] }
  for (const s of ['l', 'r'] as const) {
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let v = 0; v < n; v++) {
      if (side(v) !== s) continue
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k]!, pos[v * 3 + k]!)
        hi[k] = Math.max(hi[k]!, pos[v * 3 + k]!)
      }
    }
    if (!Number.isFinite(lo[0]!)) return undefined
    centres[s] = lo.map((x, k) => (x + hi[k]!) / 2)
  }
  const centre = [0, 1, 2].map((k) => (centres.l[k]! + centres.r[k]!) / 2) as [
    number,
    number,
    number
  ]

  const unitAngle = (unit: FaceUnitName, s: 'l' | 'r'): number | undefined => {
    const t = node.targetNames.indexOf(unit)
    if (t < 0) return undefined
    const d = readVec3(g, prim.targets[t].POSITION)
    let best = -1
    let bestLength = 0
    for (let v = 0; v < n; v++) {
      if (side(v) !== s) continue
      const l = Math.hypot(d[v * 3]!, d[v * 3 + 1]!, d[v * 3 + 2]!)
      if (l > bestLength) {
        bestLength = l
        best = v
      }
    }
    if (best < 0) return undefined
    const c = centres[s]
    const a = [0, 1, 2].map((k) => pos[best * 3 + k]! - c[k]!)
    const b = [0, 1, 2].map((k) => a[k]! + d[best * 3 + k]!)
    const dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
    const cross = Math.hypot(
      a[1]! * b[2]! - a[2]! * b[1]!,
      a[2]! * b[0]! - a[0]! * b[2]!,
      a[0]! * b[1]! - a[1]! * b[0]!
    )
    return (Math.atan2(cross, dot) * 180) / Math.PI
  }

  const turn: EyeMeasure['turn'] = {}
  for (const p of VRM_PRESETS) {
    if (!p.name.startsWith('look')) continue
    const angles = p.units.flatMap(([unit]) => {
      const s = unit.startsWith('Left') ? 'l' : 'r'
      const a = unitAngle(unit, s)
      return a === undefined ? [] : [a]
    })
    if (angles.length > 0)
      turn[p.name] = angles.reduce((x, y) => x + y, 0) / angles.length
  }
  return { centre, turn }
}

/** VRM's default range when an angle could not be measured. */
const DEFAULT_RANGE_DEGREES = 90

const range = (degrees: number | undefined): Json => ({
  inputMaxValue:
    degrees === undefined || !(degrees > 0)
      ? DEFAULT_RANGE_DEGREES
      : Math.round(degrees * 10) / 10,
  outputScale: 1,
})

/**
 * `lookAt`, of type expression: UAL's skeleton has no eye joints, so the
 * eyes turn by face units (lookUp, lookDown, lookLeft, lookRight). Its
 * origin is the point between the eyes, given in the head joint's local
 * frame (three-vrm applies it with the head node's world matrix). Each
 * range maps the angle a look preset turns the eyes at weight 1 to weight 1,
 * so a target at that angle gets the full unit and one past it is clamped.
 */
export function vrmLookAt(g: Glb): Json {
  const nodes = g.json.nodes as Array<{ name?: string }>
  const head = nodes.findIndex((n) => n.name === 'Head')
  if (head < 0) throw new Error('vrm: the GLB has no Head joint')
  const eyes = measureEyes(g)
  const world = worldMatrices(g.json)[head]!
  const offset = eyes === undefined ? [0, 0.06, 0] : toLocal(world, eyes.centre)
  const turn = eyes?.turn ?? {}
  const horizontal = Math.max(turn.lookLeft ?? 0, turn.lookRight ?? 0)
  return {
    offsetFromHeadBone: offset.map((x) => Math.round(x * 1e5) / 1e5),
    type: 'expression',
    rangeMapHorizontalInner: range(horizontal || undefined),
    rangeMapHorizontalOuter: range(horizontal || undefined),
    rangeMapVerticalDown: range(turn.lookDown),
    rangeMapVerticalUp: range(turn.lookUp),
  }
}

/** One licence entry as a line of `meta.thirdPartyLicenses`. */
export function licenceLine(e: LicenceEntry): string {
  return `${e.title} (${e.asset}): ${e.licence}, ${e.licenceUrl}; by ${
    e.author
  }; from ${e.source}${e.modified === true ? '; modified by Dramatis' : ''}${
    e.attribution !== undefined ? `; credit: ${e.attribution}` : ''
  }`
}

/**
 * VRM's `meta`. The use terms are the widest the character's assets allow:
 * anyone may perform as it, commercially, and redistribute and modify it,
 * unless an asset's licence is non-commercial (NC) or no-derivatives (ND);
 * credit is required when any asset is CC BY. The content flags (violent,
 * sexual, political or religious, antisocial or hateful use) stay at VRM's
 * default, false: those are the author's to grant, not the assets'.
 */
export function vrmMeta(
  extras: ExportExtras,
  copyright: string | undefined,
  meta: VrmMeta = {}
): Json {
  const licences = extras.licences
  const nc = licences.some((e) => /(^|-)NC(-|$)/.test(e.licence))
  const nd = licences.some((e) => /(^|-)ND(-|$)/.test(e.licence))
  const credit = licences.some(
    (e) => e.attribution !== undefined || /^CC-BY/.test(e.licence)
  )
  const name = meta.name ?? (extras.character || 'Dramatis character')
  const authors =
    meta.authors !== undefined && meta.authors.length > 0
      ? [...meta.authors]
      : [...DEFAULT_AUTHORS]
  return {
    name,
    authors,
    ...(copyright !== undefined && copyright !== ''
      ? { copyrightInformation: copyright }
      : {}),
    contactInformation: meta.contactInformation ?? CREATOR_URL,
    references: [...new Set(licences.map((e) => e.source))],
    thirdPartyLicenses: licences.map(licenceLine).join('\n'),
    licenseUrl: VRM_LICENSE_URL,
    avatarPermission: 'everyone',
    allowExcessivelyViolentUsage: false,
    allowExcessivelySexualUsage: false,
    commercialUsage: nc ? 'personalNonProfit' : 'corporation',
    allowPoliticalOrReligiousUsage: false,
    allowAntisocialOrHateUsage: false,
    creditNotation: credit ? 'required' : 'unnecessary',
    allowRedistribution: true,
    modification: nd ? 'prohibited' : 'allowModificationRedistribution',
    otherLicenseUrl: LICENCES_PAGE_URL,
  }
}

/** `humanoid.humanBones`: each VRM bone's node, by the joint's `ue` name. */
export function vrmHumanBones(json: Json): Record<string, { node: number }> {
  const skin = (json.skins as Array<{ joints: number[] }> | undefined)?.[0]
  if (skin === undefined) throw new Error('vrm: the GLB has no skin')
  const nodes = json.nodes as Array<{ name?: string }>
  const byName = new Map(skin.joints.map((i) => [nodes[i]?.name, i]))
  const out: Record<string, { node: number }> = {}
  for (const [bone, joint] of Object.entries(VRM_HUMAN_BONES)) {
    const node = byName.get(joint)
    if (node === undefined)
      throw new Error(`vrm: the skeleton has no ${joint} for ${bone}`)
    out[bone] = { node }
  }
  return out
}

/**
 * A profile GLB (`ue` naming, T-pose rest) as VRM 1.0 bytes: the same bytes
 * with `VRMC_vrm` added to the JSON. Throws when the GLB is not a Dramatis
 * export under `ue` naming in the T-pose, which VRM's humanoid needs.
 */
export function vrmFromGlb(glb: Uint8Array, meta: VrmMeta = {}): Uint8Array {
  const g = readGlb(glb)
  const json = g.json
  const extras = json.asset?.extras?.[EXTRAS_KEY] as ExportExtras | undefined
  if (extras === undefined)
    throw new Error('vrm: not a Dramatis export (no asset.extras.dramatis)')
  if (extras.naming !== 'ue')
    throw new Error(`vrm: needs ue naming, the GLB is ${extras.naming}`)
  if (extras.restPose !== 't-pose')
    throw new Error(
      `vrm: VRM needs the T-pose rest, the GLB is ${extras.restPose}`
    )
  const preset = vrmExpressions(json)
  // Look-at is by expression, so it needs all four look presets; a file
  // exported without the eye units gets none rather than a lopsided one.
  const canLook = LOOK_PRESETS.every((p) => preset[p] !== undefined)
  const vrm: Json = {
    specVersion: '1.0',
    meta: vrmMeta(extras, json.asset?.copyright, meta),
    humanoid: { humanBones: vrmHumanBones(json) },
    ...(canLook ? { lookAt: vrmLookAt(g) } : {}),
    expressions: { preset },
  }
  json.extensionsUsed = [
    ...((json.extensionsUsed as string[] | undefined) ?? []).filter(
      (e) => e !== VRMC_VRM
    ),
    VRMC_VRM,
  ]
  json.extensions = { ...(json.extensions ?? {}), [VRMC_VRM]: vrm }
  return writeGlb(g.json, g.bin)
}

/**
 * A built character as VRM 1.0 bytes, synchronously: `writeCharacterGlb`
 * (`ue` naming) then `vrmFromGlb`. The character must be built with the
 * T-pose rest, the default.
 */
export function writeCharacterVrm(
  built: BuiltCharacter,
  options: { meta?: VrmMeta } = {}
): Uint8Array {
  if (built.restPose !== 't-pose')
    throw new Error(
      `vrm: VRM needs the T-pose rest, the character is built in ${built.restPose}`
    )
  return vrmFromGlb(writeCharacterGlb(built, { naming: 'ue' }), options.meta)
}

/**
 * A character file to VRM 1.0 bytes (a GLB with `VRMC_vrm`): the GLB
 * profile plus a humanoid bone map, expression presets mapped from the face
 * units, look-at by the eye units (UAL has no eye joints), and meta
 * carrying the licences.
 */
export async function exportCharacterVrm(
  character: Character,
  pack: HumanPack,
  options: VrmExportOptions = {}
): Promise<Uint8Array> {
  const built = await buildCharacter(character, pack, {
    restPose: 't-pose',
    ...(options.faceUnits !== undefined
      ? { faceUnits: options.faceUnits }
      : {}),
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  })
  return writeCharacterVrm(built, { meta: options.meta ?? {} })
}
