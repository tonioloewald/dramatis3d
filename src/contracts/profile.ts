// The exported-GLB profile as data. Normative text: site/docs/export-format.md.
// Everything here is implemented (it is the spec, not a lane's work), engine-free
// and DOM-free, so the writer, the three.js adapter and the gate-1 harness all
// read the same names.

import type { LicenceEntry } from './licences'

/** The profile's version, written to `asset.extras.dramatis.version`. */
export const EXPORT_PROFILE_VERSION = 1

/** `asset.extras.dramatis.format`. */
export const EXPORT_FORMAT = 'dramatis-export'

/** The key under `asset.extras` that carries Dramatis's metadata. */
export const EXTRAS_KEY = 'dramatis'

const SIDES = ['l', 'r'] as const
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const

function ueJointTable(): Array<readonly [string, string | null]> {
  const rows: Array<readonly [string, string | null]> = [
    ['root', null],
    ['pelvis', 'root'],
    ['spine_01', 'pelvis'],
    ['spine_02', 'spine_01'],
    ['spine_03', 'spine_02'],
    ['neck_01', 'spine_03'],
    ['Head', 'neck_01'],
  ]
  for (const s of SIDES) {
    rows.push(
      [`clavicle_${s}`, 'spine_03'],
      [`upperarm_${s}`, `clavicle_${s}`],
      [`lowerarm_${s}`, `upperarm_${s}`],
      [`hand_${s}`, `lowerarm_${s}`]
    )
    for (const f of FINGERS) {
      rows.push(
        [`${f}_01_${s}`, `hand_${s}`],
        [`${f}_02_${s}`, `${f}_01_${s}`],
        [`${f}_03_${s}`, `${f}_02_${s}`],
        [`${f}_04_leaf_${s}`, `${f}_03_${s}`]
      )
    }
    rows.push(
      [`thigh_${s}`, 'pelvis'],
      [`calf_${s}`, `thigh_${s}`],
      [`foot_${s}`, `calf_${s}`],
      [`ball_${s}`, `foot_${s}`],
      [`ball_leaf_${s}`, `ball_${s}`]
    )
  }
  return rows
}

/**
 * The 65 joints of the exported skeleton in the `ue` naming profile, in the
 * order `skins[*].joints` lists them, each with its parent (`null` for
 * `root`). These are tosijs-3d's `HM08_UAL` rows, which are Quaternius'
 * Universal Animation Library skeleton: UE mannequin names, with UAL's own
 * spelling (`Head` is capitalised, finger tips and toe tips are `_leaf`).
 * A parent always comes before its children.
 */
export const UE_JOINTS: readonly {
  readonly name: string
  readonly parent: string | null
}[] = Object.freeze(
  ueJointTable().map(([name, parent]) => Object.freeze({ name, parent }))
)

/** Just the names of `UE_JOINTS`, in order. */
export const UE_JOINT_NAMES: readonly string[] = Object.freeze(
  UE_JOINTS.map((j) => j.name)
)

/**
 * The joints a third-party clip must bind to and move for gate 1: the
 * spine, neck and head, and each limb down to the hand and the foot.
 */
export const MAJOR_JOINTS: readonly string[] = Object.freeze([
  'pelvis',
  'spine_01',
  'spine_02',
  'spine_03',
  'neck_01',
  'Head',
  ...SIDES.flatMap((s) => [
    `clavicle_${s}`,
    `upperarm_${s}`,
    `lowerarm_${s}`,
    `hand_${s}`,
    `thigh_${s}`,
    `calf_${s}`,
    `foot_${s}`,
  ]),
])

/** Skeleton naming: UE mannequin (UAL, the default) or Mixamo's. */
export type NamingProfile = 'ue' | 'mixamo'

const MIXAMO_FINGER: Record<(typeof FINGERS)[number], string> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
}

function mixamoTable(): Record<string, string> {
  const m: Record<string, string> = {
    // Mixamo has no joint above the hips; the profile keeps UAL's floor
    // joint, under its own name, as a non-humanoid parent.
    root: 'root',
    pelvis: 'mixamorig:Hips',
    spine_01: 'mixamorig:Spine',
    spine_02: 'mixamorig:Spine1',
    spine_03: 'mixamorig:Spine2',
    neck_01: 'mixamorig:Neck',
    Head: 'mixamorig:Head',
  }
  for (const s of SIDES) {
    const side = s === 'l' ? 'Left' : 'Right'
    m[`clavicle_${s}`] = `mixamorig:${side}Shoulder`
    m[`upperarm_${s}`] = `mixamorig:${side}Arm`
    m[`lowerarm_${s}`] = `mixamorig:${side}ForeArm`
    m[`hand_${s}`] = `mixamorig:${side}Hand`
    for (const f of FINGERS) {
      const F = MIXAMO_FINGER[f]
      m[`${f}_01_${s}`] = `mixamorig:${side}Hand${F}1`
      m[`${f}_02_${s}`] = `mixamorig:${side}Hand${F}2`
      m[`${f}_03_${s}`] = `mixamorig:${side}Hand${F}3`
      m[`${f}_04_leaf_${s}`] = `mixamorig:${side}Hand${F}4`
    }
    m[`thigh_${s}`] = `mixamorig:${side}UpLeg`
    m[`calf_${s}`] = `mixamorig:${side}Leg`
    m[`foot_${s}`] = `mixamorig:${side}Foot`
    m[`ball_${s}`] = `mixamorig:${side}ToeBase`
    m[`ball_leaf_${s}`] = `mixamorig:${side}Toe_End`
  }
  return m
}

/** UE (UAL) joint name → Mixamo joint name, for every one of `UE_JOINTS`. */
export const MIXAMO_NAMES: Readonly<Record<string, string>> = Object.freeze(
  mixamoTable()
)

/** A joint's exported name under a naming profile. */
export function jointName(ue: string, naming: NamingProfile = 'ue'): string {
  if (naming === 'ue') return ue
  const m = MIXAMO_NAMES[ue]
  if (m === undefined) throw new Error(`not a profile joint: ${ue}`)
  return m
}

/** Every joint name a naming profile exports, in `UE_JOINTS` order. */
export function jointNames(naming: NamingProfile = 'ue'): string[] {
  return UE_JOINT_NAMES.map((n) => jointName(n, naming))
}

/**
 * The face units: MakeHuman's face pose units as the hm08 pack bakes them
 * (`expression/<unit>` targets), in the pack's order. Exported morph
 * targets carry exactly these names, unprefixed, spelled as MakeHuman spells
 * them (`lowerLipUp` is lower-case, `LeftEyeturnRight` has a lower-case t).
 */
export const FACE_UNITS = Object.freeze([
  'LeftBrowDown',
  'RightBrowDown',
  'LeftOuterBrowUp',
  'RightOuterBrowUp',
  'LeftInnerBrowUp',
  'RightInnerBrowUp',
  'NoseWrinkler',
  'LeftUpperLidOpen',
  'RightUpperLidOpen',
  'LeftUpperLidClosed',
  'RightUpperLidClosed',
  'LeftLowerLidUp',
  'RightLowerLidUp',
  'LeftEyeDown',
  'RightEyeDown',
  'LeftEyeUp',
  'RightEyeUp',
  'LeftEyeturnRight',
  'RightEyeturnRight',
  'LeftEyeturnLeft',
  'RightEyeturnLeft',
  'LeftCheekUp',
  'RightCheekUp',
  'CheeksPump',
  'CheeksSuck',
  'NasolabialDeepener',
  'ChinLeft',
  'ChinRight',
  'ChinDown',
  'ChinForward',
  'lowerLipUp',
  'lowerLipDown',
  'lowerLipBackward',
  'lowerLipForward',
  'UpperLipUp',
  'UpperLipBackward',
  'UpperLipForward',
  'UpperLipStretched',
  'JawDrop',
  'JawDropStretched',
  'LipsKiss',
  'MouthMoveLeft',
  'MouthMoveRight',
  'MouthLeftPullUp',
  'MouthRightPullUp',
  'MouthLeftPullSide',
  'MouthRightPullSide',
  'MouthLeftPullDown',
  'MouthRightPullDown',
  'MouthLeftPlatysma',
  'MouthRightPlatysma',
  'TongueOut',
  'TongueUshape',
  'TongueUp',
  'TongueDown',
  'TongueLeft',
  'TongueRight',
  'TonguePointUp',
  'TonguePointDown',
] as const)

/** One of the 59 face units. */
export type FaceUnitName = (typeof FACE_UNITS)[number]

/** The pack target a face unit is baked from. */
export function faceUnitTarget(unit: FaceUnitName): string {
  return `expression/${unit}`
}

/**
 * The bind pose the export is skinned in.
 * - `t-pose`: arms straight out along ±X, palms down, legs straight; every
 *   joint's rest rotation is UAL's, so UAL clips bind by name and play
 *   without retargeting. The default, and what VRM requires.
 * - `source`: the base mesh's own rest (MakeHuman's, arms angled down);
 *   joint rotations are still UAL's frames, re-aimed along the bones.
 */
export type RestPose = 't-pose' | 'source'

/** What `asset.extras.dramatis` holds (schema: site/docs/export-format.md). */
export interface ExportExtras {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_PROFILE_VERSION
  /** The writer that made it: `dramatis@<version>`. */
  generator: string
  naming: NamingProfile
  restPose: RestPose
  /** The face units exported as morph targets, in `FACE_UNITS` order; empty if none. */
  faceUnits: FaceUnitName[]
  /** The character's name, from its file. */
  character: string
  /** Every asset in the file, one entry each; never empty (the base is always there). */
  licences: LicenceEntry[]
}

/** The licence fields every entry must have, as strings. */
export const LICENCE_FIELDS = [
  'asset',
  'title',
  'kind',
  'licence',
  'licenceUrl',
  'source',
  'author',
] as const

/**
 * What is wrong with a value read from `asset.extras.dramatis`, one line each;
 * empty when it matches the profile. This is the JSON schema in
 * site/docs/export-format.md, as code.
 */
export function checkExportExtras(value: unknown): string[] {
  const problems: string[] = []
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [`asset.extras.${EXTRAS_KEY} is missing or not an object`]
  }
  const v = value as Record<string, unknown>
  if (v.format !== EXPORT_FORMAT)
    problems.push(`format is not ${EXPORT_FORMAT}`)
  if (v.version !== EXPORT_PROFILE_VERSION)
    problems.push(`version is not ${EXPORT_PROFILE_VERSION}`)
  if (typeof v.generator !== 'string' || v.generator === '')
    problems.push('generator is not a non-empty string')
  if (v.naming !== 'ue' && v.naming !== 'mixamo')
    problems.push('naming is not ue or mixamo')
  if (v.restPose !== 't-pose' && v.restPose !== 'source')
    problems.push('restPose is not t-pose or source')
  if (typeof v.character !== 'string')
    problems.push('character is not a string')
  if (!Array.isArray(v.faceUnits)) problems.push('faceUnits is not an array')
  else {
    const known = new Set<string>(FACE_UNITS)
    for (const u of v.faceUnits)
      if (typeof u !== 'string' || !known.has(u))
        problems.push(`faceUnits has an unknown unit: ${String(u)}`)
  }
  if (!Array.isArray(v.licences) || v.licences.length === 0) {
    problems.push('licences is missing or empty')
  } else {
    v.licences.forEach((entry: unknown, i: number) => {
      if (entry === null || typeof entry !== 'object') {
        problems.push(`licences[${i}] is not an object`)
        return
      }
      const e = entry as Record<string, unknown>
      for (const field of LICENCE_FIELDS)
        if (typeof e[field] !== 'string' || e[field] === '')
          problems.push(`licences[${i}].${field} is missing`)
      if (
        e.attribution !== undefined &&
        (typeof e.attribution !== 'string' || e.attribution === '')
      )
        problems.push(`licences[${i}].attribution is empty`)
    })
    if (
      !v.licences.some(
        (e: unknown) =>
          e !== null &&
          typeof e === 'object' &&
          (e as Record<string, unknown>).kind === 'base'
      )
    )
      problems.push('licences has no entry of kind base')
  }
  return problems
}
