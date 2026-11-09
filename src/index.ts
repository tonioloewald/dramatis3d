// Documented in site/docs/dramatis-core.md.

export {
  CHARACTER_FORMAT,
  CHARACTER_VERSION,
  readCharacter,
  writeCharacter,
} from 'tosijs-3d/character-file'
export type {
  Character,
  CharacterBody,
  CharacterDoc,
  ReadCharacter,
  SlotLook,
} from 'tosijs-3d/character-file'

// The contracts: the built character, the exporter, the GLB profile's names,
// the share link and the licence manifest (src/contracts/, LANES.md).
export {
  buildCharacter,
  characterLicences,
  checkExportExtras,
  decodeShareLink,
  encodeShareLink,
  exportCharacterGlb,
  exportCharacterVrm,
  EXPORT_FORMAT,
  EXPORT_PROFILE_VERSION,
  EXTRAS_KEY,
  FACE_UNITS,
  faceUnitTarget,
  jointName,
  jointNames,
  licenceManifest,
  lookupLicence,
  MAJOR_JOINTS,
  MIXAMO_NAMES,
  SHARE_FRAGMENT_KEY,
  SHARE_LINK_BUDGET,
  SHARE_LINK_VERSION,
  UE_JOINT_NAMES,
  UE_JOINTS,
  UnlicensedAssetError,
  writeCharacterGlb,
} from './contracts'
// What a character file is read with: every setting the build reads, with
// its default (readCharacter's `defaults.settings`), and the pack it builds
// from (loadHumanPack's URL).
export { BUILD_SETTINGS, HM08_PACK_URL } from './build/settings'
export { ualClips, UAL_CLIPS_LICENCE } from './clips'
export type { ExportClip } from './clips'
// VRM 1.0 beyond the contract's exportCharacterVrm (site/docs/vrm.md).
export {
  VRM_HUMAN_BONES,
  VRM_PRESETS,
  vrmFromGlb,
  vrmProblems,
  writeCharacterVrm,
} from './vrm'
export type { VrmPreset, VrmPresetName } from './vrm'

export type {
  AssetKind,
  BuildOptions,
  BuiltCharacter,
  BuiltImage,
  BuiltJoint,
  BuiltMesh,
  BuiltMorph,
  BuiltSkeleton,
  BuiltSkin,
  EncodeShareOptions,
  ExportExtras,
  ExportOptions,
  FaceUnitName,
  LicenceEntry,
  MeshRole,
  NamingProfile,
  PbrMaterial,
  Quat,
  RestPose,
  ShareLink,
  TextureRef,
  Vec3,
  VrmExportOptions,
  VrmMeta,
} from './contracts'
