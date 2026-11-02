// The three.js viewer's logic, apart from the page: what a loaded GLB is, how
// a UAL clip binds to it, its face units and its licences. No DOM, so Bun's
// tests run it on the real samples (site/viewer/viewer.test.ts).
//
// three.js only. Never Babylon: the viewer bundle is checked for it.

import {
  AnimationClip,
  Bone,
  Mesh,
  PropertyBinding,
  SkinnedMesh,
  Vector3,
  type Object3D,
} from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { LicenceEntry } from '../../src/contracts/licences'
import {
  checkExportExtras,
  EXTRAS_KEY,
  jointName,
  LICENCE_FIELDS,
  MAJOR_JOINTS,
  UE_JOINTS,
  type ExportExtras,
  type NamingProfile,
} from '../../src/contracts/profile'
import { characterClip } from '../../src/three/clip'

/** What the viewer knows about a loaded GLB. */
export interface LoadedModel {
  /** The Dramatis block from `asset.extras`, when the file has a valid one. */
  extras: ExportExtras | null
  /** Why the block is absent or invalid; empty when it is valid. */
  extrasProblems: string[]
  /** `asset.copyright`, if any. */
  copyright: string
  /** The skeleton's naming: from the extras, else guessed from the bones. */
  naming: NamingProfile | null
  /** Every bone of every skinned mesh. */
  bones: Bone[]
  /** Every mesh with morph targets, by target name. */
  faceUnits: Map<string, Mesh[]>
  /** The animations the file itself carries. */
  ownClips: AnimationClip[]
  /** The character's name: the extras', else the file's. */
  name: string
  /**
   * The licence entries the file states: the valid block's, or, when the
   * block is invalid (a later version, a unit this viewer doesn't know),
   * every entry in it that still has its fields. Empty when there are none.
   */
  licences: LicenceEntry[]
}

/** The entries of `raw.licences` that have every field a line needs. */
function statedLicences(raw: unknown): LicenceEntry[] {
  if (raw === null || typeof raw !== 'object') return []
  const list = (raw as Record<string, unknown>).licences
  if (!Array.isArray(list)) return []
  return list.filter(
    (e): e is LicenceEntry =>
      e !== null &&
      typeof e === 'object' &&
      LICENCE_FIELDS.every(
        (f) =>
          typeof (e as Record<string, unknown>)[f] === 'string' &&
          (e as Record<string, unknown>)[f] !== ''
      )
  )
}

/** The asset's extras and copyright, as GLTFLoader keeps them. */
function assetOf(gltf: GLTF): { extras?: unknown; copyright?: unknown } {
  return (gltf.asset ?? {}) as { extras?: unknown; copyright?: unknown }
}

/** Read a GLTFLoader result into what the viewer shows. */
export function describeModel(gltf: GLTF, fileName = 'model'): LoadedModel {
  const asset = assetOf(gltf)
  const raw =
    asset.extras && typeof asset.extras === 'object'
      ? (asset.extras as Record<string, unknown>)[EXTRAS_KEY]
      : undefined
  const extrasProblems =
    raw === undefined
      ? [`no asset.extras.${EXTRAS_KEY}: not a Dramatis export`]
      : checkExportExtras(raw)
  const extras = extrasProblems.length === 0 ? (raw as ExportExtras) : null

  const bones = new Set<Bone>()
  const faceUnits = new Map<string, Mesh[]>()
  gltf.scene.traverse((o) => {
    if (o instanceof SkinnedMesh) for (const b of o.skeleton.bones) bones.add(b)
    if (o instanceof Mesh && o.morphTargetDictionary)
      for (const name of Object.keys(o.morphTargetDictionary)) {
        const list = faceUnits.get(name) ?? []
        list.push(o)
        faceUnits.set(name, list)
      }
  })
  const boneList = [...bones]
  return {
    extras,
    extrasProblems,
    copyright: typeof asset.copyright === 'string' ? asset.copyright : '',
    naming: extras?.naming ?? guessNaming(boneList),
    bones: boneList,
    faceUnits,
    ownClips: gltf.animations ?? [],
    name: extras?.character || fileName.replace(/\.(glb|gltf|vrm)$/i, ''),
    licences: extras ? extras.licences : statedLicences(raw),
  }
}

/**
 * The origin a URL-loaded file came from, when it is not the page's own:
 * its licence entries are then that site's claims, not this site's. Null
 * for a same-origin URL.
 */
export function foreignOrigin(url: string, pageHref: string): string | null {
  try {
    const page = new URL(pageHref)
    const from = new URL(url, page)
    if (from.origin === page.origin) return null
    // data: and blob: URLs have the opaque origin "null": name the scheme.
    return from.origin === 'null' ? `a ${from.protocol} URL` : from.origin
  } catch {
    return null
  }
}

/**
 * Load tickets: each load takes one, and checks it after every await. Only
 * the latest load is current, so a slower, earlier one stops instead of
 * landing its model and menus on top of the newer one.
 */
export function loadTickets(): () => () => boolean {
  let latest = 0
  return () => {
    const mine = ++latest
    return () => mine === latest
  }
}

/** `ue` when the bones have UE/UAL names, `mixamo` for Mixamo's, else null. */
export function guessNaming(bones: readonly Object3D[]): NamingProfile | null {
  const names = new Set(bones.map((b) => b.name))
  const count = (naming: NamingProfile) =>
    MAJOR_JOINTS.filter((ue) =>
      names.has(PropertyBinding.sanitizeNodeName(jointName(ue, naming)))
    ).length
  const ue = count('ue')
  const mixamo = count('mixamo')
  if (ue === 0 && mixamo === 0) return null
  return ue >= mixamo ? 'ue' : 'mixamo'
}

/** A UAL clip fitted to a model, and what fitting it took. */
export interface ClipFit {
  /** The clip to play: `characterClip`'s, renamed to the model's naming. */
  clip: AnimationClip
  /** Profile joints the clip moves on this model. */
  bound: string[]
  /** Major joints (spine, neck, head, limbs) with no bone or no track. */
  missing: string[]
  /** The hips' height ratio the root and pelvis translations are scaled by. */
  translationScale: number
  /** One sentence for the page: how the clip binds, or why it does not. */
  summary: string
  /** True when every major joint binds by name. */
  ok: boolean
}

/** A bone's rest height above the floor, from a scene at rest. */
function restHeight(root: Object3D, name: string): number | null {
  const node = PropertyBinding.findNode(root, name) as Object3D | null
  if (!node) return null
  root.updateMatrixWorld(true)
  return node.getWorldPosition(new Vector3()).y
}

/**
 * Fit a UAL clip (UE mannequin names) to a model by name. Nothing is
 * retargeted: the profile copies UAL's joint frames, so rotation keys mean
 * the same on both skeletons. Under Mixamo naming the tracks are renamed,
 * and nothing else. `ualScene` is the clip file's scene at rest, for the
 * hips' height; `modelScene` the model's, at rest.
 */
export function fitClip(
  clip: AnimationClip,
  model: LoadedModel,
  modelScene: Object3D,
  ualScene: Object3D | null
): ClipFit {
  const naming = model.naming ?? 'ue'
  const sanitized = (ue: string) =>
    PropertyBinding.sanitizeNodeName(jointName(ue, naming))
  const ualHips = ualScene ? restHeight(ualScene, 'pelvis') : null
  const ourHips = restHeight(modelScene, sanitized('pelvis'))
  const translationScale =
    ualHips && ourHips && ualHips > 0 ? ourHips / ualHips : 1
  const fitted = characterClip(clip, { naming, translationScale })

  const boneNames = new Set(model.bones.map((b) => b.name))
  const tracked = new Set(
    fitted.tracks.map((t) => PropertyBinding.parseTrackName(t.name).nodeName)
  )
  const bound = UE_JOINTS.map((j) => j.name).filter(
    (ue) => boneNames.has(sanitized(ue)) && tracked.has(sanitized(ue))
  )
  const missing = MAJOR_JOINTS.filter((ue) => !bound.includes(ue))
  const ok = missing.length === 0
  const how =
    naming === 'mixamo'
      ? 'by name, its UE track names renamed to Mixamo’s (the same joints and rest frames), no retargeting'
      : 'by name, no retargeting'
  const summary = ok
    ? `${clip.name} plays ${how}: ${bound.length} of ${UE_JOINTS.length} joints bound.`
    : model.bones.length === 0
    ? `${clip.name} can’t play: this file has no skinned skeleton.`
    : `${
        clip.name
      } doesn’t match this skeleton’s names: no bone or no track for ${missing.join(
        ', '
      )}. It would need retargeting, which this viewer doesn’t do.`
  return { clip: fitted, bound, missing, translationScale, summary, ok }
}

/** Set one face unit on every mesh that has it (one name is one unit). */
export function setFaceUnit(
  model: LoadedModel,
  unit: string,
  weight: number
): number {
  let n = 0
  for (const mesh of model.faceUnits.get(unit) ?? []) {
    const i = mesh.morphTargetDictionary?.[unit]
    if (i === undefined || !mesh.morphTargetInfluences) continue
    mesh.morphTargetInfluences[i] = weight
    n++
  }
  return n
}

/** The face units to offer, in the file's order when it lists them. */
export function faceUnitNames(model: LoadedModel): string[] {
  const listed = model.extras?.faceUnits.filter((u) => model.faceUnits.has(u))
  return listed && listed.length > 0 ? listed : [...model.faceUnits.keys()]
}

/** A licence entry as one line of text (for the copyright fallback too). */
export function licenceLine(entry: LicenceEntry): string {
  const credit = entry.attribution ? ` Credit: ${entry.attribution}` : ''
  const changed = entry.modified ? ' (modified by Dramatis)' : ''
  return `${entry.title}${changed}: ${entry.licence}, by ${entry.author}.${credit}`
}
