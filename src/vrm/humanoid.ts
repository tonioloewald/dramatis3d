// VRM 1.0's humanoid bones on the profile skeleton (site/docs/export-format.md,
// "What VRM adds"). UAL's skeleton is a UE mannequin, which is close to
// VRM's humanoid already: one joint per VRM bone, three spine joints for
// spine / chest / upperChest, and three joints per finger. `root` (the floor
// joint) and the `_leaf` tips are not human bones.

/** A VRM 1.0 human bone name (VRMC_vrm humanoid.humanBones keys). */
export type VrmHumanBoneName =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'upperChest'
  | 'neck'
  | 'head'
  | 'leftEye'
  | 'rightEye'
  | 'jaw'
  | `${'left' | 'right'}${
      | 'UpperLeg'
      | 'LowerLeg'
      | 'Foot'
      | 'Toes'
      | 'Shoulder'
      | 'UpperArm'
      | 'LowerArm'
      | 'Hand'
      | 'ThumbMetacarpal'
      | 'ThumbProximal'
      | 'ThumbDistal'
      | `${'Index' | 'Middle' | 'Ring' | 'Little'}${
          | 'Proximal'
          | 'Intermediate'
          | 'Distal'}`}`

const SIDES = [
  ['left', 'l'],
  ['right', 'r'],
] as const
const FINGERS = [
  ['Index', 'index'],
  ['Middle', 'middle'],
  ['Ring', 'ring'],
  ['Little', 'pinky'],
] as const

function table(): Array<[VrmHumanBoneName, string]> {
  const rows: Array<[VrmHumanBoneName, string]> = [
    ['hips', 'pelvis'],
    ['spine', 'spine_01'],
    ['chest', 'spine_02'],
    ['upperChest', 'spine_03'],
    ['neck', 'neck_01'],
    ['head', 'Head'],
  ]
  for (const [side, s] of SIDES) {
    rows.push(
      [`${side}Shoulder`, `clavicle_${s}`],
      [`${side}UpperArm`, `upperarm_${s}`],
      [`${side}LowerArm`, `lowerarm_${s}`],
      [`${side}Hand`, `hand_${s}`],
      [`${side}ThumbMetacarpal`, `thumb_01_${s}`],
      [`${side}ThumbProximal`, `thumb_02_${s}`],
      [`${side}ThumbDistal`, `thumb_03_${s}`]
    )
    for (const [F, f] of FINGERS)
      rows.push(
        [`${side}${F}Proximal`, `${f}_01_${s}`],
        [`${side}${F}Intermediate`, `${f}_02_${s}`],
        [`${side}${F}Distal`, `${f}_03_${s}`]
      )
    rows.push(
      [`${side}UpperLeg`, `thigh_${s}`],
      [`${side}LowerLeg`, `calf_${s}`],
      [`${side}Foot`, `foot_${s}`],
      [`${side}Toes`, `ball_${s}`]
    )
  }
  return rows
}

/**
 * VRM human bone → profile joint (`ue` name), for the 52 bones the profile
 * skeleton has. VRM's `leftEye`, `rightEye` and `jaw` are not mapped: UAL
 * has no eye or jaw joints (the eyes and jaw move by face units instead).
 */
export const VRM_HUMAN_BONES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(table())
)

/** The bones VRM 1.0 requires every model to map. */
export const VRM_REQUIRED_BONES: readonly VrmHumanBoneName[] = Object.freeze([
  'hips',
  'spine',
  'head',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
])

/**
 * VRM 1.0's bone hierarchy: each human bone's parent bones, nearest first.
 * The nearest mapped human ancestor of a bone's node must be the first of
 * these that is mapped (VRM 1.0 humanoid, "parent-child relationship").
 */
export function vrmParents(bone: string): string[] {
  const trunk: Record<string, string[]> = {
    hips: [],
    spine: ['hips'],
    chest: ['spine'],
    upperChest: ['chest'],
    neck: ['upperChest', 'chest', 'spine'],
    head: ['neck', 'upperChest', 'chest', 'spine'],
    leftEye: ['head'],
    rightEye: ['head'],
    jaw: ['head'],
  }
  if (trunk[bone] !== undefined) return trunk[bone]!
  const m = /^(left|right)(.*)$/.exec(bone)
  if (m === null) throw new Error(`vrm: not a human bone: ${bone}`)
  const side = m[1]!
  const part = m[2]!
  const limb: Record<string, string[]> = {
    UpperLeg: ['hips'],
    LowerLeg: [`${side}UpperLeg`],
    Foot: [`${side}LowerLeg`],
    Toes: [`${side}Foot`],
    Shoulder: ['upperChest', 'chest', 'spine'],
    UpperArm: [`${side}Shoulder`, 'upperChest', 'chest', 'spine'],
    LowerArm: [`${side}UpperArm`],
    Hand: [`${side}LowerArm`],
    ThumbMetacarpal: [`${side}Hand`],
    ThumbProximal: [`${side}ThumbMetacarpal`, `${side}Hand`],
    ThumbDistal: [`${side}ThumbProximal`],
  }
  if (limb[part] !== undefined) return limb[part]!
  const f = /^(Index|Middle|Ring|Little)(Proximal|Intermediate|Distal)$/.exec(
    part
  )
  if (f === null) throw new Error(`vrm: not a human bone: ${bone}`)
  const finger = f[1]!
  if (f[2] === 'Proximal') return [`${side}Hand`]
  if (f[2] === 'Intermediate') return [`${side}${finger}Proximal`]
  return [`${side}${finger}Intermediate`]
}

/** Every VRM 1.0 human bone name, for the checker. */
export const VRM_BONE_NAMES: ReadonlySet<string> = new Set([
  ...table().map(([b]) => b),
  'leftEye',
  'rightEye',
  'jaw',
])
