# VRM

<!--{"parent": "docs", "order": 11}-->

A character also leaves Dramatis as a **VRM 1.0** file (`.vrm`), the avatar
format VTuber apps, VRChat-style worlds and VRM viewers read. A Dramatis VRM
is the [GLB export](/export/) with one more extension, `VRMC_vrm`, in its
JSON: the geometry, the skeleton, the face as morph targets, the materials
and the licences are byte for byte the GLB's. VRM only names what is
already there: which joint is which human bone, which face units make which
expression, where the eyes are, and the licence terms in VRM's own words.
The profile is normative: [Export format](/export-format/), "What VRM adds".

```ts
import { loadHumanPack } from 'tosijs-3d/human-pack'
import { exportCharacterVrm } from 'dramatis'

const pack = await loadHumanPack(
  'https://cdn.tosijs.net/makehuman/hm08/hm08.json?v=17'
)
const vrm = await exportCharacterVrm(character, pack, {
  meta: { name: 'Ada', authors: ['Ada L.'] },
})
// vrm is a Uint8Array: save it as ada.vrm
```

Also exported: `writeCharacterVrm(built)` (a built character to VRM,
synchronously), `vrmFromGlb(glb)` (any Dramatis GLB under `ue` naming in
the T-pose, to VRM), `vrmProblems(bytes)` (the structural check below), and
the two tables, `VRM_HUMAN_BONES` and `VRM_PRESETS`.

## What is in it

- **Always `ue` naming and the T-pose rest.** VRM 1.0 wants a T-pose, and
  the profile's bind pose is one. A Mixamo-named GLB, or one built with
  `restPose: 'source'`, is refused with a reason.
- **Faces +Z**, as VRM 1.0 (and the profile) say. three-vrm and UniVRM need
  no turn.
- **No MToon, no spring bones.** Materials stay plain glTF PBR, which VRM
  1.0 allows; hair does not swing. Both can be added later without changing
  anything here.

### Humanoid

UAL's skeleton is a UE mannequin, close to VRM's humanoid already: one joint
per VRM bone, 52 in all.

| VRM bone | Joint |
| --- | --- |
| `hips`, `spine`, `chest`, `upperChest` | `pelvis`, `spine_01`, `spine_02`, `spine_03` |
| `neck`, `head` | `neck_01`, `Head` |
| `leftShoulder`, `leftUpperArm`, `leftLowerArm`, `leftHand` | `clavicle_l`, `upperarm_l`, `lowerarm_l`, `hand_l` |
| `leftThumbMetacarpal`, `leftThumbProximal`, `leftThumbDistal` | `thumb_01_l`, `thumb_02_l`, `thumb_03_l` |
| `leftIndexProximal`, `...Intermediate`, `...Distal` (and `Middle`, `Ring`, `Little`) | `index_01_l`, `index_02_l`, `index_03_l` (and `middle`, `ring`, `pinky`) |
| `leftUpperLeg`, `leftLowerLeg`, `leftFoot`, `leftToes` | `thigh_l`, `calf_l`, `foot_l`, `ball_l` |
| the same on the right | the same with `_r` |

`root` (the floor joint) and the `_leaf` tips are not human bones. VRM's
`leftEye`, `rightEye` and `jaw` are not mapped: UAL has no eye or jaw
joints, so the eyes and jaw move by face units.

### Expressions

Each preset is a weighted set of the 59 face units, bound on **every mesh
that carries the unit** (one unit on the body, the lashes, the brows and the
teeth is one unit: they move together). A unit the export lacks is left
out; a preset with no units left is left out.

"Left" in a unit's name is the **character's** left (+X), measured, not
assumed: every Left unit moves vertices at x > 0, and `LeftEyeturnLeft`
turns the eye's front towards +X. VRM's `blinkLeft` and `lookLeft` are the
avatar's own left too (three-vrm sends a target on the avatar's +X to
`lookLeft`), so no side is swapped.

The weights are a first cut, judged from what each unit moves; they have
not yet been looked at in a VTuber app (see the spike report,
`reports/spike-3-vrm.md`). They live in `src/vrm/expressions.ts` as data.

| Preset | Face units and weights | Overrides | Why |
| --- | --- | --- | --- |
| `happy` | `MouthLeftPullUp` 0.9, `MouthRightPullUp` 0.9, `LeftCheekUp` 0.6, `RightCheekUp` 0.6, `LeftLowerLidUp` 0.3, `RightLowerLidUp` 0.3 | blink blend | A smile is the mouth corners up; the cheeks and lower lids rise with a real one (the Duchenne smile). Blinking is damped, not blocked, since the lids are already partly up. |
| `angry` | `LeftBrowDown` 1, `RightBrowDown` 1, `NoseWrinkler` 0.4, `LeftLowerLidUp` 0.3, `RightLowerLidUp` 0.3, `MouthLeftPullDown` 0.5, `MouthRightPullDown` 0.5, `lowerLipUp` 0.3 | blink blend | Brows down and drawn in, the nose wrinkled, a squint, and the mouth pressed and pulled down. |
| `sad` | `LeftInnerBrowUp` 1, `RightInnerBrowUp` 1, `LeftUpperLidClosed` 0.2, `RightUpperLidClosed` 0.2, `MouthLeftPullDown` 0.8, `MouthRightPullDown` 0.8, `lowerLipUp` 0.3 | blink blend | The inner brows up (the grief brow), the upper lids drooping, the mouth corners down and the lower lip pushed up. |
| `relaxed` | `LeftUpperLidClosed` 0.35, `RightUpperLidClosed` 0.35, `MouthLeftPullUp` 0.3, `MouthRightPullUp` 0.3 | blink blend | Soft, half-lowered lids and the hint of a smile. |
| `surprised` | `LeftInnerBrowUp` 1, `RightInnerBrowUp` 1, `LeftOuterBrowUp` 1, `RightOuterBrowUp` 1, `LeftUpperLidOpen` 1, `RightUpperLidOpen` 1, `JawDrop` 0.35 | blink block, mouth blend | The whole brow up, the eyes wide (so no blinking) and the jaw dropped; visemes are damped so speech does not open the mouth past a gape. |
| `aa` | `JawDrop` 0.8, `UpperLipUp` 0.2 | none | The open vowel: the jaw well down, the upper lip lifted a little off the teeth. |
| `ih` | `JawDrop` 0.25, `MouthLeftPullSide` 0.35, `MouthRightPullSide` 0.35 | none | A narrow opening with the lips spread a little. |
| `ou` | `LipsKiss` 1, `UpperLipForward` 0.3, `lowerLipForward` 0.3, `JawDrop` 0.15 | none | Rounded, pushed-forward lips over a small opening. |
| `ee` | `MouthLeftPullSide` 0.7, `MouthRightPullSide` 0.7, `UpperLipUp` 0.2, `JawDrop` 0.1 | none | The lips spread wide over nearly closed teeth. |
| `oh` | `JawDrop` 0.5, `LipsKiss` 0.6 | none | Rounded lips over a medium opening: between aa and ou. |
| `blink` | `LeftUpperLidClosed` 1, `RightUpperLidClosed` 1 | none | Both upper lids closed (the profile: blink is both). |
| `blinkLeft` | `LeftUpperLidClosed` 1 | none | The character's left upper lid (Left units move x > 0, the character's left). |
| `blinkRight` | `RightUpperLidClosed` 1 | none | The character's right upper lid. |
| `lookUp` | `LeftEyeUp` 1, `RightEyeUp` 1 | none | Both eyes up. |
| `lookDown` | `LeftEyeDown` 1, `RightEyeDown` 1 | none | Both eyes down. |
| `lookLeft` | `LeftEyeturnLeft` 1, `RightEyeturnLeft` 1 | none | Both eyes to the character's left (+X), which is VRM's lookLeft. |
| `lookRight` | `LeftEyeturnRight` 1, `RightEyeturnRight` 1 | none | Both eyes to the character's right (-X). |

`neutral` is left out: the rest face is neutral. The remaining units (the
tongue's, `CheeksPump`, `ChinLeft` and the rest) are still morph targets in
the file, by name, for apps that drive units directly.

### Look-at

**By expression**, not by bone: UAL has no eye joints, so the eyes turn by
the eye units through `lookUp`, `lookDown`, `lookLeft` and `lookRight`.

- **The origin** (`offsetFromHeadBone`) is the point between the eyeballs'
  centres, measured from the `eyes` mesh and given in the `Head` joint's
  local frame, which is how three-vrm applies it. The head joint is within
  2° of the model's axes, so a reader that takes the offset in model axes
  is off by a few millimetres at most.
- **The ranges** map the angle each look preset turns the eyes at weight 1
  (measured per character: about 18° to 28° on the samples) to weight 1. A
  target at that angle gets the full unit; one further out is clamped.
- An export without all four eye units gets no look-at, rather than a
  lopsided one.

### Meta and licences

| Field | Value |
| --- | --- |
| `name` | `meta.name`, else the character's name |
| `authors` | `meta.authors`, else `Dramatis user` |
| `contactInformation` | `meta.contactInformation`, else the creator's URL |
| `licenseUrl` | `https://vrm.dev/licenses/1.0/` |
| `otherLicenseUrl` | the [licences page](/licences/) |
| `copyrightInformation` | the GLB's `asset.copyright` line: every asset, `<title>: <licence>` |
| `thirdPartyLicenses` | one line per asset: title, id, licence and its URL, author, source, and a CC BY credit line word for word |
| `references` | each asset's source, once |

The full entries stay in `asset.extras.dramatis.licences` too, as in every
export.

The **use terms** are the widest the character's assets allow: anyone may
perform as it (`avatarPermission: everyone`), commercially
(`commercialUsage: corporation`), and redistribute and modify it
(`allowModificationRedistribution`), unless an asset is non-commercial (NC,
then `personalNonProfit`) or no-derivatives (ND, then `prohibited`). Credit
is `required` when any asset is CC BY (the Monk Skin Tone Scale is, so in
practice always), `unnecessary` otherwise. The content flags (excessively
violent or sexual, political or religious, antisocial or hateful use) are
left at VRM's default, **false**: those are the author's to grant, not the
assets'. Change them in a VRM editor if you mean to.

## How it is checked

Every VRM in the tests (`src/vrm/vrm.test.ts`, on the committed samples and
a fixture) is checked four ways:

1. **`vrmProblems`**, the structural check of `VRMC_vrm` against the 1.0
   schema and against the file: required bones present, no node used twice,
   each bone's nearest human ancestor is the one VRM's hierarchy wants,
   every morph bind on a mesh node and a real target with a weight in
   [0, 1], meta's required fields and enums, look-at ranges. Each failure is
   shown to fire on a broken file.
2. **The Khronos glTF validator**: zero errors. It reports `VRMC_vrm` as an
   extension it cannot validate (an info), which is why (1) exists.
3. **The gate-1 profile checks** (skeleton, morph targets, licences): a VRM
   is still a profile GLB.
4. **@pixiv/three-vrm under three.js**: it loads with every bone and preset;
   `aa` sets `JawDrop` to 0.8 on the body and the teeth; `blinkLeft` closes
   only the left lid; looking at a point on the character's left drives
   `lookLeft` and `LeftEyeturnLeft`; the normalized rig is a T-pose facing
   +Z, and lowering its left upper arm lowers the raw `hand_l`.

Not yet checked: UniVRM (Unity), VSeeFace, VRoid Hub or any VTuber app. A
sample to try by hand is `reports/spike-3-vrm/long-hair.vrm`.
