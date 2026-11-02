// The exporter. GLB lane: skinned-glb (src/build/ and src/upstream/glb/).
// VRM lane: vrm (src/vrm/). Normative profile: site/docs/export-format.md.

import type { BuildOptions } from './built-character'
import type { NamingProfile } from './profile'

/** How a character is exported. */
export interface ExportOptions {
  /** Skeleton naming. Default `ue` (UE mannequin, as UAL names it). */
  naming?: NamingProfile
  /**
   * The face units as morph targets: true for all (the default), false for
   * none, or a list of `FACE_UNITS`.
   */
  faceUnits?: BuildOptions['faceUnits']
  /** The bind pose. Default `t-pose`. */
  restPose?: BuildOptions['restPose']
  /**
   * Fetches assets the pack does not carry: its textures, and the eye art
   * (`https://cdn.tosijs.net/tonio/eyes/<style>-eye.png?v=…`). Default
   * `fetch`. If the eye art can't be fetched, the eyes keep a plain material.
   */
  fetch?: BuildOptions['fetch']
}

/**
 * Write a built character as a GLB to the profile, synchronously: the one
 * GLB writer. `naming` renames joints on the way out; the rest of
 * `ExportOptions` was settled when the character was built.
 *
 * A character file to GLB bytes (`exportCharacterGlb`): `buildCharacter`
 * then `writeCharacterGlb`. Async because building fetches the pack's
 * targets and proxies.
 *
 * Implemented by lane skinned-glb (src/build/), same signatures and docs.
 */
export { exportCharacterGlb, writeCharacterGlb } from '../build'

/** VRM's meta, beyond what the licence entries give. */
export interface VrmMeta {
  /** Default: the character's name. */
  name?: string
  /** Default: `['Dramatis user']`. */
  authors?: string[]
  /** Default: the creator's URL. */
  contactInformation?: string
}

/**
 * How a character is exported as VRM 1.0. Naming is always `ue` underneath
 * (VRM's humanoid map names the bones) and the rest pose is always the
 * T-pose, which VRM requires.
 */
export interface VrmExportOptions {
  /** As `ExportOptions.faceUnits`; the presets need at least the visemes, blink and lids. */
  faceUnits?: ExportOptions['faceUnits']
  fetch?: ExportOptions['fetch']
  meta?: VrmMeta
}

/**
 * A character file to VRM 1.0 bytes (a GLB with `VRMC_vrm`): the GLB
 * profile plus a humanoid bone map, expression presets mapped from the face
 * units, look-at by the eye units (UAL has no eye joints), and meta
 * carrying the licences.
 *
 * Implemented by lane vrm (src/vrm/), same signature and doc.
 */
export { exportCharacterVrm } from '../vrm/vrm'
