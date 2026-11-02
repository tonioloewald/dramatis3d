// A BuiltCharacter to GLB bytes, to the profile (site/docs/export-format.md):
// joints renamed per the naming profile, the face units' names in
// `mesh.extras.targetNames`, the licences in `asset.extras.dramatis` and as
// one line in `asset.copyright`. The bytes are written by the general
// skinned-GLB writer, tosijs-3d/skinned-glb (moved there from Dramatis).

import type { BuiltCharacter } from '../contracts/built-character'
import type { LicenceEntry } from '../contracts/licences'
import {
  EXPORT_FORMAT,
  EXPORT_PROFILE_VERSION,
  EXTRAS_KEY,
  type ExportExtras,
  jointName,
  type NamingProfile,
  UE_JOINT_NAMES,
} from '../contracts/profile'
import { writeSkinnedGlb } from 'tosijs-3d/skinned-glb'
import { NAMINGS, option } from './options'
import { GENERATOR } from './version'

/** `asset.copyright`: `<title>: <licence>` per asset, CC BY credit lines word for word. */
export function copyrightLine(licences: readonly LicenceEntry[]): string {
  return licences
    .map(
      (e) =>
        `${e.title}: ${e.licence}${
          e.attribution !== undefined ? ` (${e.attribution})` : ''
        }`
    )
    .join('; ')
}

/** The `asset.extras.dramatis` block for a built character. */
export function exportExtras(
  built: BuiltCharacter,
  naming: NamingProfile
): ExportExtras {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_PROFILE_VERSION,
    generator: GENERATOR,
    naming,
    restPose: built.restPose,
    faceUnits: [...built.faceUnits],
    character: built.name,
    licences: built.licences.map((e) => ({ ...e })),
  }
}

/**
 * Write a built character as a GLB to the profile, synchronously: the one
 * GLB writer. `naming` renames joints on the way out; the rest of
 * `ExportOptions` was settled when the character was built.
 */
export function writeCharacterGlb(
  built: BuiltCharacter,
  options: { naming?: NamingProfile } = {}
): Uint8Array {
  const naming = option(
    'writeCharacterGlb',
    'naming',
    options.naming,
    NAMINGS,
    'ue'
  )
  if (built.licences.length === 0)
    throw new Error(
      'writeCharacterGlb: a character with no licence entries cannot be written'
    )
  const joints = built.skeleton.joints
  if (joints.map((j) => j.name).join() !== UE_JOINT_NAMES.join())
    throw new Error(
      'writeCharacterGlb: the skeleton is not the profile skeleton'
    )
  const ibm = new Float32Array(joints.length * 16)
  joints.forEach((j, i) => ibm.set(j.inverseBind, i * 16))
  const declared = new Set(built.faceUnits)
  return writeSkinnedGlb({
    asset: {
      generator: GENERATOR,
      copyright: copyrightLine(built.licences),
      extras: { [EXTRAS_KEY]: exportExtras(built, naming) },
    },
    joints: joints.map((j) => ({
      name: jointName(j.name, naming),
      parent: j.parent,
      translation: j.translation,
      rotation: j.rotation,
    })),
    skinName: 'skeleton',
    skeletonRoot: 0,
    inverseBindMatrices: ibm,
    meshes: built.meshes.map((m) => {
      for (const t of m.morphs)
        if (!declared.has(t.name))
          throw new Error(
            `writeCharacterGlb: ${m.name} carries ${t.name}, which the character does not declare`
          )
      return {
        name: m.name,
        primitives: [
          {
            positions: m.positions,
            normals: m.normals,
            uvs: m.uvs,
            joints: m.skin.joints,
            weights: m.skin.weights,
            indices: m.indices,
            material: m.material,
            targets: m.morphs.map((t) => ({ positions: t.positions })),
          },
        ],
        targetNames: m.morphs.map((t) => t.name),
      }
    }),
    materials: built.materials,
    images: built.images.map((im) => ({
      name: im.name,
      mimeType: im.mimeType,
      bytes: im.bytes,
    })),
  })
}
