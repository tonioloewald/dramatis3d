// VRM 1.0's preset expressions as weighted sets of the 59 face units.
//
// The units are MakeHuman's face pose units as the hm08 pack bakes them
// (FACE_UNITS in src/contracts/profile.ts). What each one does was measured
// on an export (samples/out/long-hair.glb), not guessed from its name; the
// numbers are in reports/spike-3-vrm.md. What the measurement settled:
//
// - "Left" is the CHARACTER's left (+X in the profile frame): every Left unit
//   moves vertices at x > 0. VRM's blinkLeft and lookLeft are the avatar's
//   own left too (three-vrm maps a target on the avatar's +X to lookLeft),
//   so Left maps to left with no swap.
// - `LeftEyeturnLeft` turns the left eye's front towards +X, the character's
//   left; `RightEyeturnLeft` turns the right eye the same way. So lookLeft is
//   both `...EyeturnLeft` units, and lookRight both `...EyeturnRight`.
// - `JawDrop` is the big mover (32 mm at the chin, teeth and tongue with it),
//   `LipsKiss` purses (7 mm), the `Mouth...PullSide` pair spreads the lips,
//   the `Mouth...PullUp` pair is the smile, `...PullDown` the frown.
//
// The weights are a first cut, judged by what each unit moves, not yet by
// eye in a VRM viewer or a VTuber app (spike 3's open half). They are data:
// change them here and the docs table and the tests follow.

import type { FaceUnitName } from '../contracts/profile'

/** VRM 1.0's preset expression names (VRMC_vrm expressions.preset keys). */
export type VrmPresetName =
  | 'happy'
  | 'angry'
  | 'sad'
  | 'relaxed'
  | 'surprised'
  | 'aa'
  | 'ih'
  | 'ou'
  | 'ee'
  | 'oh'
  | 'blink'
  | 'blinkLeft'
  | 'blinkRight'
  | 'lookUp'
  | 'lookDown'
  | 'lookLeft'
  | 'lookRight'
  | 'neutral'

/** VRM's override modes: what an active expression does to blink, look-at or mouth ones. */
export type VrmOverride = 'none' | 'block' | 'blend'

/** One preset: the units it sets and how strongly, and why. */
export interface VrmPreset {
  name: VrmPresetName
  /** Face unit → weight in [0, 1]. A unit the export lacks is left out. */
  units: ReadonlyArray<readonly [FaceUnitName, number]>
  overrideBlink?: VrmOverride
  overrideLookAt?: VrmOverride
  overrideMouth?: VrmOverride
  /** The reasoning, one sentence, for the docs. */
  why: string
}

const both = (
  left: FaceUnitName,
  right: FaceUnitName,
  w: number
): Array<readonly [FaceUnitName, number]> => [
  [left, w],
  [right, w],
]

/**
 * The presets, in VRM's order. `neutral` is left out: the rest face is
 * neutral, and an empty expression only adds noise.
 */
export const VRM_PRESETS: readonly VrmPreset[] = Object.freeze([
  // Moods.
  {
    name: 'happy',
    units: [
      ...both('MouthLeftPullUp', 'MouthRightPullUp', 0.9),
      ...both('LeftCheekUp', 'RightCheekUp', 0.6),
      ...both('LeftLowerLidUp', 'RightLowerLidUp', 0.3),
    ],
    overrideBlink: 'blend',
    why: 'A smile is the mouth corners up; the cheeks and lower lids rise with a real one (the Duchenne smile). Blinking is damped, not blocked, since the lids are already partly up.',
  },
  {
    name: 'angry',
    units: [
      ...both('LeftBrowDown', 'RightBrowDown', 1),
      ['NoseWrinkler', 0.4],
      ...both('LeftLowerLidUp', 'RightLowerLidUp', 0.3),
      ...both('MouthLeftPullDown', 'MouthRightPullDown', 0.5),
      ['lowerLipUp', 0.3],
    ],
    overrideBlink: 'blend',
    why: 'Brows down and drawn in, the nose wrinkled, a squint, and the mouth pressed and pulled down.',
  },
  {
    name: 'sad',
    units: [
      ...both('LeftInnerBrowUp', 'RightInnerBrowUp', 1),
      ...both('LeftUpperLidClosed', 'RightUpperLidClosed', 0.2),
      ...both('MouthLeftPullDown', 'MouthRightPullDown', 0.8),
      ['lowerLipUp', 0.3],
    ],
    overrideBlink: 'blend',
    why: 'The inner brows up (the grief brow), the upper lids drooping, the mouth corners down and the lower lip pushed up.',
  },
  {
    name: 'relaxed',
    units: [
      ...both('LeftUpperLidClosed', 'RightUpperLidClosed', 0.35),
      ...both('MouthLeftPullUp', 'MouthRightPullUp', 0.3),
    ],
    overrideBlink: 'blend',
    why: 'Soft, half-lowered lids and the hint of a smile.',
  },
  {
    name: 'surprised',
    units: [
      ...both('LeftInnerBrowUp', 'RightInnerBrowUp', 1),
      ...both('LeftOuterBrowUp', 'RightOuterBrowUp', 1),
      ...both('LeftUpperLidOpen', 'RightUpperLidOpen', 1),
      ['JawDrop', 0.35],
    ],
    overrideBlink: 'block',
    overrideMouth: 'blend',
    why: 'The whole brow up, the eyes wide (so no blinking) and the jaw dropped; visemes are damped so speech does not open the mouth past a gape.',
  },
  // Visemes.
  {
    name: 'aa',
    units: [
      ['JawDrop', 0.8],
      ['UpperLipUp', 0.2],
    ],
    why: 'The open vowel: the jaw well down, the upper lip lifted a little off the teeth.',
  },
  {
    name: 'ih',
    units: [
      ['JawDrop', 0.25],
      ...both('MouthLeftPullSide', 'MouthRightPullSide', 0.35),
    ],
    why: 'A narrow opening with the lips spread a little.',
  },
  {
    name: 'ou',
    units: [
      ['LipsKiss', 1],
      ['UpperLipForward', 0.3],
      ['lowerLipForward', 0.3],
      ['JawDrop', 0.15],
    ],
    why: 'Rounded, pushed-forward lips over a small opening.',
  },
  {
    name: 'ee',
    units: [
      ...both('MouthLeftPullSide', 'MouthRightPullSide', 0.7),
      ['UpperLipUp', 0.2],
      ['JawDrop', 0.1],
    ],
    why: 'The lips spread wide over nearly closed teeth.',
  },
  {
    name: 'oh',
    units: [
      ['JawDrop', 0.5],
      ['LipsKiss', 0.6],
    ],
    why: 'Rounded lips over a medium opening: between aa and ou.',
  },
  // Blink.
  {
    name: 'blink',
    units: both('LeftUpperLidClosed', 'RightUpperLidClosed', 1),
    why: 'Both upper lids closed (the profile: blink is both).',
  },
  {
    name: 'blinkLeft',
    units: [['LeftUpperLidClosed', 1]],
    why: "The character's left upper lid (Left units move x > 0, the character's left).",
  },
  {
    name: 'blinkRight',
    units: [['RightUpperLidClosed', 1]],
    why: "The character's right upper lid.",
  },
  // Look-at (lookAt.type is expression: UAL has no eye joints).
  {
    name: 'lookUp',
    units: both('LeftEyeUp', 'RightEyeUp', 1),
    why: 'Both eyes up.',
  },
  {
    name: 'lookDown',
    units: both('LeftEyeDown', 'RightEyeDown', 1),
    why: 'Both eyes down.',
  },
  {
    name: 'lookLeft',
    units: both('LeftEyeturnLeft', 'RightEyeturnLeft', 1),
    why: "Both eyes to the character's left (+X), which is VRM's lookLeft.",
  },
  {
    name: 'lookRight',
    units: both('LeftEyeturnRight', 'RightEyeturnRight', 1),
    why: "Both eyes to the character's right (-X).",
  },
] satisfies VrmPreset[])

/** The look-at presets, which `lookAt` drives by angle. */
export const LOOK_PRESETS = Object.freeze([
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
] as const)
