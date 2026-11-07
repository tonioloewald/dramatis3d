// Lane skinned-glb: the contract functions of src/contracts/built-character.ts
// and src/contracts/export.ts, which re-export these.

import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack } from 'tosijs-3d/human-pack'
import type { BuildOptions, BuiltCharacter } from '../contracts/built-character'
import type { ExportOptions } from '../contracts/export'
import { characterLicences } from '../contracts/licences'
import { buildCharacterWith } from './build'
import { NAMINGS, option } from './options'
import { writeCharacterGlb } from './write'
import { exportMeshGlb, hasMeshBody } from '../mesh'

export { writeCharacterGlb }

/**
 * Build a character from its file and the loaded pack: the body morphed to
 * its sliders, UAL's skeleton placed in it and posed to the rest pose,
 * skinned (max 4 influences), covered skin removed, each worn proxy and the
 * hair fitted and skinned to the same skeleton, the face units baked as
 * morphs, materials as plain PBR, and the licence entries collected.
 *
 * Not yet: the skin is one flat colour (no baked albedo, lips or stubble)
 * and the eyes plain white. Throws for what does not export yet: Quaternius
 * hair and brows, garments of the character's own, bodies other than
 * MakeHuman's.
 *
 * Throws `UnlicensedAssetError` (licences.ts) when the character uses an
 * asset the manifest has no entry for.
 */
export async function buildCharacter(
  character: Character,
  pack: HumanPack,
  options: BuildOptions = {}
): Promise<BuiltCharacter> {
  return buildCharacterWith(character, pack, options, {
    licences: characterLicences,
  })
}

/**
 * A character file to GLB bytes: `buildCharacter` then `writeCharacterGlb`.
 * Async because building fetches the pack's targets and proxies.
 */
export async function exportCharacterGlb(
  character: Character,
  pack: HumanPack,
  options: ExportOptions = {}
): Promise<Uint8Array> {
  // Checked before the build, which is the slow part.
  const naming = option(
    'exportCharacterGlb',
    'naming',
    options.naming,
    NAMINGS,
    'ue'
  )
  // A mesh body (rigged in the rig tool) is written by tosijs-3d's
  // rigged-body GLB writer: no MakeHuman build, no face units (src/mesh/).
  if (hasMeshBody(character))
    return exportMeshGlb(character, {
      naming,
      ...(options.restPose !== undefined ? { restPose: options.restPose } : {}),
      ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    })
  const built = await buildCharacter(character, pack, {
    ...(options.faceUnits !== undefined
      ? { faceUnits: options.faceUnits }
      : {}),
    ...(options.restPose !== undefined ? { restPose: options.restPose } : {}),
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  })
  return writeCharacterGlb(built, { naming })
}
