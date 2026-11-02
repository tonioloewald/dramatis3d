# Spike 3: VRM

**Question (PLAN.md):** one character into a VRM viewer and a VTuber app;
which face units map to which presets.

**Answer so far:** a Dramatis character exports as a VRM 1.0 file that the
reference loader, **@pixiv/three-vrm 3.5.5 under three.js 0.186**, reads with
every human bone, every preset expression and look-at working, and that the
Khronos validator passes with zero errors. The face-unit-to-preset table is
below and in `src/vrm/expressions.ts`. **Not run:** any VTuber app
(VSeeFace, VTube Studio, Warudo), UniVRM in Unity, VRoid Hub, or a human
looking at the expressions. Those need a desktop and a person; a sample is
committed for that (`reports/spike-3-vrm/long-hair.vrm`).

## What was built

`exportCharacterVrm` (src/vrm/, the contract in src/contracts/export.ts) is
the GLB export plus the `VRMC_vrm` 1.0 extension. The binary chunk is the
GLB writer's, untouched (a test compares it byte for byte), so a VRM cannot
drift from the GLB in geometry, skin, morphs, materials or licences. Adding
VRM costs about 17 KB of JSON on a 4.7 to 5.5 MB file and 1 to 3 ms.

| Sample | GLB | VRM | Eye turn at weight 1 (up / down / left / right) |
| --- | --- | --- | --- |
| clothed-casual | 4.91 MB | 4.93 MB | 24.7° / 24.9° / 22.8° / 22.8° |
| long-hair | 4.65 MB | 4.67 MB | 26.7° / 28.2° / 25.3° / 25.3° |
| extreme-heavy | 5.47 MB | 5.49 MB | 19.8° / 19.6° / 18.1° / 18.1° |

## Evidence

All in `bun test src/vrm` (offline, on the committed samples) and
`DRAMATIS_NETWORK=1 bun test src/vrm` (a real build through the contract):

- **Structure.** `vrmProblems` checks VRMC_vrm against the 1.0 schema and
  the file (required bones, unique nodes, VRM's bone hierarchy, binds on
  real targets with weights in [0, 1], meta fields and enums, look-at
  ranges): clean on all three samples and the network build. Each kind of
  failure is shown to fire on a broken copy.
- **Validator.** Khronos glTF validator 2.0.0-dev.3.10: 0 errors, 0
  warnings, 1 info (`UNSUPPORTED_EXTENSION` for VRMC_vrm, which it does not
  read; hence the structural check).
- **Still a profile GLB.** The gate-1 skeleton, morph and licence checks
  pass on the VRMs.
- **three-vrm.** Loads each sample with `VRMLoaderPlugin`: `meta.metaVersion`
  1, all 52 human bones on the right joints, all 17 presets. Driven:
  - `aa` at 1 sets `JawDrop` to 0.8 on the body **and** the teeth (one unit
    on several meshes moves together);
  - `blinkLeft` closes the left lid only;
  - `lookAt` at a point 0.3 m to the character's left (+X) and 1 m ahead
    sets `lookLeft` above 0.3 and `LeftEyeturnLeft` with it, `lookRight` 0;
  - the normalized rig is a T-pose (left hand ≥ 0.35 m out on +X, within
    8 cm of the shoulder's height) facing +Z, and turning its
    `leftUpperArm` 80° lowers the raw `hand_l` by more than 0.3 m. So the
    root's -90° X relic and UAL's joint frames do not confuse three-vrm's
    normalization.

## Which face units map to which presets

Measured first (`bun test src/vrm`, "the face units do what the presets
assume"; raw numbers from `samples/out/long-hair.glb`), because the names
alone leave two questions open:

1. **Whose left?** Every `Left...` unit moves vertices at x > 0, the
   character's own left in the profile frame (e.g. `LeftUpperLidClosed`
   centre x = +0.031 m, `RightUpperLidClosed` −0.031 m). three-vrm sends a
   target on the avatar's +X to `lookLeft`, and VRM's `blinkLeft` is the
   avatar's left eye. **No swap.**
2. **Which way do the eye units turn?** `LeftEyeturnLeft` moves the left
   eye's front +2.4 mm in x (towards +X), and `RightEyeturnLeft` moves the
   right eye +2.4 mm too: "turn left" is towards the character's left for
   both eyes. So `lookLeft` = both `...EyeturnLeft`.

What the units move (long-hair, the body mesh, largest vertex movement):
`JawDrop` 32 mm (teeth 31, tongue 29), `JawDropStretched` 39, `LipsKiss`
7, `MouthLeftPullUp` 14 (up 6 mm, back 4 mm: a smile), `MouthLeftPullSide`
10 (out and up: a spread), `MouthLeftPullDown` 4, `UpperLipStretched` 19,
`UpperLidClosed` 9 (lashes 12), `UpperLidOpen` 5, `LowerLidUp` 5,
`InnerBrowUp` 9, `OuterBrowUp` 10, `BrowDown` 7, `CheekUp` 11,
`NoseWrinkler` 7.

The table (weights a first cut from those movements; the reasoning for each
row is in site/docs/vrm.md and `VRM_PRESETS[].why`):

| Preset | Units |
| --- | --- |
| aa | JawDrop 0.8, UpperLipUp 0.2 |
| ih | JawDrop 0.25, Mouth{Left,Right}PullSide 0.35 |
| ou | LipsKiss 1, UpperLipForward 0.3, lowerLipForward 0.3, JawDrop 0.15 |
| ee | Mouth{Left,Right}PullSide 0.7, UpperLipUp 0.2, JawDrop 0.1 |
| oh | JawDrop 0.5, LipsKiss 0.6 |
| blink / blinkLeft / blinkRight | {Left,Right}UpperLidClosed 1 |
| happy | Mouth{L,R}PullUp 0.9, {L,R}CheekUp 0.6, {L,R}LowerLidUp 0.3; blink blend |
| angry | {L,R}BrowDown 1, NoseWrinkler 0.4, {L,R}LowerLidUp 0.3, Mouth{L,R}PullDown 0.5, lowerLipUp 0.3; blink blend |
| sad | {L,R}InnerBrowUp 1, {L,R}UpperLidClosed 0.2, Mouth{L,R}PullDown 0.8, lowerLipUp 0.3; blink blend |
| relaxed | {L,R}UpperLidClosed 0.35, Mouth{L,R}PullUp 0.3; blink blend |
| surprised | {L,R}InnerBrowUp 1, {L,R}OuterBrowUp 1, {L,R}UpperLidOpen 1, JawDrop 0.35; blink block, mouth blend |
| lookUp / lookDown | {L,R}EyeUp 1 / {L,R}EyeDown 1 |
| lookLeft / lookRight | {L,R}EyeturnLeft 1 / {L,R}EyeturnRight 1 |

Unused by any preset (still in the file as named morph targets): the eight
tongue units, `CheeksPump`, `CheeksSuck`, `NasolabialDeepener`, the four
`Chin...`, `lowerLipDown`, `lowerLipBackward`, `UpperLipBackward`,
`UpperLipStretched`, `JawDropStretched`, `MouthMove{Left,Right}` and the
`Platysma` pair.

## Look-at

- **Expression, not bone.** The task brief said "look-at from the eye
  joints", but UAL's 65-joint skeleton has none, and the fixed profile
  (site/docs/export-format.md) says look-at is by expression. That is what
  was built. Adding eye joints would change the profile skeleton (65 joints,
  pinned by gate 1), so it is not a VRM-lane change.
- **Origin.** The midpoint of the two eyeball centres (bounds of the `eyes`
  mesh split at x = 0), in the `Head` joint's local frame. three-vrm applies
  `offsetFromHeadBone` with the raw head node's world matrix, which is what
  this assumes; the VRM 1.0 spec text only says "offset from the head bone".
  The ambiguity costs little here: the head joint is 1.9° off the model's
  axes on every sample, so another reading moves the origin by about 3 mm.
  three-vrm's look-at origin lands on the measured eye midpoint exactly
  (long-hair: 0, 1.439, 0.088 m).
- **Ranges.** `inputMaxValue` is the measured turn at weight 1 (table
  above), `outputScale` 1: a target at that angle gets the full unit. The
  turn is measured on the eye's most-moved vertex about the eyeball centre;
  a morph is a linear stand-in for a rotation, so it is approximate.

## Meta

`licenseUrl` is VRM's own (`https://vrm.dev/licenses/1.0/`);
`otherLicenseUrl` is the Dramatis licences page; `copyrightInformation` is
the GLB's `asset.copyright` line; `thirdPartyLicenses` has one line per
asset with its credit line word for word; `references` lists the sources.
The use terms are the widest the assets allow (everyone, commercial,
redistribution, modification), narrowed automatically for an NC or ND
asset; credit is `required` because the Monk Skin Tone Scale is CC BY 4.0.
The content flags (violent, sexual, political or religious, antisocial)
are left false, VRM's default: granting them is the author's decision, and
`VrmMeta` in the contract has no field for it yet (a later additive field).

## Open

1. **A VTuber app and a person.** Load `reports/spike-3-vrm/long-hair.vrm`
   in VSeeFace or VTube Studio (via UniVRM), and in a web VRM viewer, and
   judge each preset by eye. The likely adjustments: `blink` may not fully
   close (UpperLidClosed moves the lid 9 mm; whether the lids meet was not
   measured), `ou`/`oh` may need more `LipsKiss`, `happy` may want the
   mouth open a little.
2. **UniVRM's reading of `offsetFromHeadBone`** (see Look-at): harmless at
   1.9°, but worth confirming.
3. **First person.** No `firstPerson` annotations are written, so apps use
   their default (`auto`). Hair and lashes may need `thirdPersonOnly`.
4. **No MToon, no spring bones, no thumbnail.** Plain PBR is valid VRM 1.0;
   VTuber apps will look flatter than MToon avatars, and hair will not
   swing. A thumbnail (`meta.thumbnailImage`) needs a render, which the
   engine-free core cannot do; the creator could pass one.
5. **The creator has no VRM button.** That is the site-creator lane's;
   `exportCharacterVrm` is ready for it.
