// Lane vrm: VRM 1.0 export (site/docs/vrm.md). The contract function
// `exportCharacterVrm` (src/contracts/export.ts) re-exports it from here.

export { vrmJsonProblems, vrmProblems } from './check'
export {
  LOOK_PRESETS,
  VRM_PRESETS,
  type VrmOverride,
  type VrmPreset,
  type VrmPresetName,
} from './expressions'
export {
  VRM_HUMAN_BONES,
  VRM_REQUIRED_BONES,
  type VrmHumanBoneName,
} from './humanoid'
export { VRM_LICENSE_URL, VRMC_VRM } from './spec'
export {
  CREATOR_URL,
  DEFAULT_AUTHORS,
  type EyeMeasure,
  exportCharacterVrm,
  LICENCES_PAGE_URL,
  licenceLine,
  measureEyes,
  vrmExpressions,
  vrmFromGlb,
  vrmHumanBones,
  vrmLookAt,
  vrmMeta,
  writeCharacterVrm,
} from './vrm'
