# Export format

<!--{"parent": "docs", "order": 10}-->

**Normative.** This page is the profile every Dramatis GLB and VRM export
follows, version 1. The writer (`writeCharacterGlb`), the three.js adapter
(`characterObject`) and the gate-1 harness (`test/gate1/`) are all built to
it. Where it says MUST, a file that does otherwise is a bug in the writer;
the harness fails it. The same names are in code, in
`src/contracts/profile.ts` (`UE_JOINTS`, `MIXAMO_NAMES`, `FACE_UNITS`,
`checkExportExtras`), and a test pins them to tosijs-3d.

## The file

- A **GLB** (binary glTF 2.0): one JSON chunk and one binary chunk. Every
  buffer and image is embedded; there are no external URIs.
- `extensionsRequired` is empty, so every glTF loader opens the file.
  `KHR_materials_sheen` may be in `extensionsUsed` (cloth); a loader that
  lacks it draws the cloth without sheen.
- The **Khronos glTF validator reports zero errors**. Warnings are allowed
  but are bugs to fix.
- One scene. Its top nodes are the `root` joint and one node per mesh. **No
  node carries a transform except the joints**, and mesh nodes are never
  parented under a joint (glTF ignores a skinned mesh's parent transforms,
  and engines disagree about it).

## Units, axes, root

- **Metres, Y up, right-handed**, as glTF defines it.
- The character **faces +Z**, its left hand on **+X**.
- **Root at the feet.** The `root` joint is at the origin, on the floor
  directly under the pelvis. Its rotation is UAL's: -90° about X, a relic of
  Blender's Z-up armature, which its children's rest rotations undo (the
  profile copies UAL's joint frames, so it copies this too). The soles touch
  y = 0: the lowest point of the body's skin is at y = 0 within a
  millimetre.

## Nodes and meshes

One mesh per part of the character, each its own node, the node and the
mesh sharing a name:

| Name | What |
| --- | --- |
| `body` | The skin, with covered skin removed (`coverBody`), not hidden |
| `eyes` | Both eyeballs |
| `eyelashes`, `teeth`, `tongue`, `brows`, `beard` | When the character has them |
| `hair` | The hair, whichever kind |
| `garment_<asset>` | Each worn garment, by its asset name (`garment_toigo_harem_pants`) |

Names are ASCII letters, digits and `_`. Each mesh has one primitive per
material (usually one), `mode` 4 (triangles), indexed, with `POSITION`,
`NORMAL`, `TEXCOORD_0` (when textured), `JOINTS_0` and `WEIGHTS_0`. The
order of the meshes is the order above, garments by asset name.

## Skeleton

- **One skin, named `skeleton`**, used by every mesh node, with `skeleton`
  set to the `root` joint and `inverseBindMatrices` given.
- Its `joints` are **exactly the 65 below, in this order**, named per the
  file's naming profile (`ue`, the default, or `mixamo`). Parents are as
  listed; a parent always comes before its children.
- These are **UE mannequin names as Quaternius' Universal Animation Library
  (UAL) spells them**: tosijs-3d's `HM08_UAL`. Note `Head` (capital H) and the
  `_leaf` tips, which carry no skin weight and exist so engines know where a
  finger or a toe ends.
- Joints carry `translation` and `rotation` only (scale 1).
- The **Mixamo profile** renames joints and nothing else. Mixamo has no
  joint above the hips, so `root` keeps its name there, as a non-humanoid
  parent. three.js strips the `:` when binding (`mixamorigHips`), as it does
  for Mixamo's own files. Whether Unity's Humanoid needs it at all is
  spike 1's question.

| # | ue | parent | mixamo |
| --- | --- | --- | --- |
| 0 | `root` | none | `root` |
| 1 | `pelvis` | `root` | `mixamorig:Hips` |
| 2 | `spine_01` | `pelvis` | `mixamorig:Spine` |
| 3 | `spine_02` | `spine_01` | `mixamorig:Spine1` |
| 4 | `spine_03` | `spine_02` | `mixamorig:Spine2` |
| 5 | `neck_01` | `spine_03` | `mixamorig:Neck` |
| 6 | `Head` | `neck_01` | `mixamorig:Head` |
| 7 | `clavicle_l` | `spine_03` | `mixamorig:LeftShoulder` |
| 8 | `upperarm_l` | `clavicle_l` | `mixamorig:LeftArm` |
| 9 | `lowerarm_l` | `upperarm_l` | `mixamorig:LeftForeArm` |
| 10 | `hand_l` | `lowerarm_l` | `mixamorig:LeftHand` |
| 11 | `thumb_01_l` | `hand_l` | `mixamorig:LeftHandThumb1` |
| 12 | `thumb_02_l` | `thumb_01_l` | `mixamorig:LeftHandThumb2` |
| 13 | `thumb_03_l` | `thumb_02_l` | `mixamorig:LeftHandThumb3` |
| 14 | `thumb_04_leaf_l` | `thumb_03_l` | `mixamorig:LeftHandThumb4` |
| 15 | `index_01_l` | `hand_l` | `mixamorig:LeftHandIndex1` |
| 16 | `index_02_l` | `index_01_l` | `mixamorig:LeftHandIndex2` |
| 17 | `index_03_l` | `index_02_l` | `mixamorig:LeftHandIndex3` |
| 18 | `index_04_leaf_l` | `index_03_l` | `mixamorig:LeftHandIndex4` |
| 19 | `middle_01_l` | `hand_l` | `mixamorig:LeftHandMiddle1` |
| 20 | `middle_02_l` | `middle_01_l` | `mixamorig:LeftHandMiddle2` |
| 21 | `middle_03_l` | `middle_02_l` | `mixamorig:LeftHandMiddle3` |
| 22 | `middle_04_leaf_l` | `middle_03_l` | `mixamorig:LeftHandMiddle4` |
| 23 | `ring_01_l` | `hand_l` | `mixamorig:LeftHandRing1` |
| 24 | `ring_02_l` | `ring_01_l` | `mixamorig:LeftHandRing2` |
| 25 | `ring_03_l` | `ring_02_l` | `mixamorig:LeftHandRing3` |
| 26 | `ring_04_leaf_l` | `ring_03_l` | `mixamorig:LeftHandRing4` |
| 27 | `pinky_01_l` | `hand_l` | `mixamorig:LeftHandPinky1` |
| 28 | `pinky_02_l` | `pinky_01_l` | `mixamorig:LeftHandPinky2` |
| 29 | `pinky_03_l` | `pinky_02_l` | `mixamorig:LeftHandPinky3` |
| 30 | `pinky_04_leaf_l` | `pinky_03_l` | `mixamorig:LeftHandPinky4` |
| 31 | `thigh_l` | `pelvis` | `mixamorig:LeftUpLeg` |
| 32 | `calf_l` | `thigh_l` | `mixamorig:LeftLeg` |
| 33 | `foot_l` | `calf_l` | `mixamorig:LeftFoot` |
| 34 | `ball_l` | `foot_l` | `mixamorig:LeftToeBase` |
| 35 | `ball_leaf_l` | `ball_l` | `mixamorig:LeftToe_End` |
| 36 | `clavicle_r` | `spine_03` | `mixamorig:RightShoulder` |
| 37 | `upperarm_r` | `clavicle_r` | `mixamorig:RightArm` |
| 38 | `lowerarm_r` | `upperarm_r` | `mixamorig:RightForeArm` |
| 39 | `hand_r` | `lowerarm_r` | `mixamorig:RightHand` |
| 40 | `thumb_01_r` | `hand_r` | `mixamorig:RightHandThumb1` |
| 41 | `thumb_02_r` | `thumb_01_r` | `mixamorig:RightHandThumb2` |
| 42 | `thumb_03_r` | `thumb_02_r` | `mixamorig:RightHandThumb3` |
| 43 | `thumb_04_leaf_r` | `thumb_03_r` | `mixamorig:RightHandThumb4` |
| 44 | `index_01_r` | `hand_r` | `mixamorig:RightHandIndex1` |
| 45 | `index_02_r` | `index_01_r` | `mixamorig:RightHandIndex2` |
| 46 | `index_03_r` | `index_02_r` | `mixamorig:RightHandIndex3` |
| 47 | `index_04_leaf_r` | `index_03_r` | `mixamorig:RightHandIndex4` |
| 48 | `middle_01_r` | `hand_r` | `mixamorig:RightHandMiddle1` |
| 49 | `middle_02_r` | `middle_01_r` | `mixamorig:RightHandMiddle2` |
| 50 | `middle_03_r` | `middle_02_r` | `mixamorig:RightHandMiddle3` |
| 51 | `middle_04_leaf_r` | `middle_03_r` | `mixamorig:RightHandMiddle4` |
| 52 | `ring_01_r` | `hand_r` | `mixamorig:RightHandRing1` |
| 53 | `ring_02_r` | `ring_01_r` | `mixamorig:RightHandRing2` |
| 54 | `ring_03_r` | `ring_02_r` | `mixamorig:RightHandRing3` |
| 55 | `ring_04_leaf_r` | `ring_03_r` | `mixamorig:RightHandRing4` |
| 56 | `pinky_01_r` | `hand_r` | `mixamorig:RightHandPinky1` |
| 57 | `pinky_02_r` | `pinky_01_r` | `mixamorig:RightHandPinky2` |
| 58 | `pinky_03_r` | `pinky_02_r` | `mixamorig:RightHandPinky3` |
| 59 | `pinky_04_leaf_r` | `pinky_03_r` | `mixamorig:RightHandPinky4` |
| 60 | `thigh_r` | `pelvis` | `mixamorig:RightUpLeg` |
| 61 | `calf_r` | `thigh_r` | `mixamorig:RightLeg` |
| 62 | `foot_r` | `calf_r` | `mixamorig:RightFoot` |
| 63 | `ball_r` | `foot_r` | `mixamorig:RightToeBase` |
| 64 | `ball_leaf_r` | `ball_r` | `mixamorig:RightToe_End` |

## Skinning

- At most **four influences per vertex**: `JOINTS_0` (unsigned byte or
  short) and `WEIGHTS_0` (float), weights renormalised to sum to 1 and
  unused slots 0.
- Garments, hair, brows and the rest are skinned to the **same** skeleton as
  the body, so clothing deforms with it.

## Rest pose: the T-pose

The bind pose is a **T-pose**: arms straight out along ±X, palms down, legs
straight and slightly apart, as UAL's mannequin stands. Every joint's rest
rotation is **UAL's own joint frame** (the bone along the joint's local +Y,
as Blender exports it); only the translations are the character's.

Why, decided for version 1:

1. **UAL clips then play by name, unretargeted.** A clip's rotation keys are
   relative to its skeleton's rest frames. With the same frames, they mean the
   same thing on our skeleton, so a three.js `AnimationMixer` or a Godot
   `AnimationPlayer` plays UAL's clips on an export as is. This is the gate's
   test (below).
2. **VRM requires a T-pose**, and Unity's Humanoid and Unreal's IK Retargeter
   both prefer one: their auto-mapping assumes it.
3. **UAL is a T-pose already** (measured from `UAL1.glb`: the hands at the
   shoulders' height, 0.74 m out). MakeHuman's own rest holds the arms
   angled down, so the export re-poses MakeHuman's bind to the T-pose; that is
   linear-blend skinning of the baked mesh, done once at export.

`restPose: 'source'` (an option, not the default) keeps MakeHuman's rest
instead, with UAL's frames re-aimed along its bones. Clips then need
retargeting; it exists for tools that want the sculpted rest.

### Playing UAL clips

A UAL clip's translation keys hold the **mannequin's** bone lengths, so
played on another body they stretch it. Play its **rotation** tracks on
every joint and its **translation** tracks on `root` and `pelvis` only
(ideally scaling the pelvis's by the ratio of the hips' heights). That is
what the gate's clip check does (`clipForExport` in `test/gate1/checks.ts`).

## Morph targets: the face units

- The face goes out as **morph targets, one per face unit**: MakeHuman's face
  pose units as the hm08 pack bakes them, **named exactly as below** (no
  prefix; MakeHuman's own spelling, `lowerLipUp` and `LeftEyeturnRight`
  included).
- **Names are in `mesh.extras.targetNames`**, one per target, in the order
  below. That is the convention three.js, Babylon, Blender, Godot, Unity's
  glTFast and Unreal's Interchange read.
- Each mesh carries the units **that move it**: the body most, the lashes,
  brows, beard, teeth, tongue and eyes theirs. **One name on several meshes
  is one unit**: drive them together. `mesh.weights` are all 0.
- `POSITION` deltas, metres; `NORMAL` deltas optional. Sparse accessors are
  allowed (most units move a few hundred vertices).
- The units in the file are listed in `asset.extras.dramatis.faceUnits`; the
  harness checks that they are exactly the ones on the meshes. Exporting
  without face units (`faceUnits: false`) lists none and writes no targets.

The 59 units, in order:

`LeftBrowDown`, `RightBrowDown`, `LeftOuterBrowUp`, `RightOuterBrowUp`, `LeftInnerBrowUp`, `RightInnerBrowUp`, `NoseWrinkler`, `LeftUpperLidOpen`, `RightUpperLidOpen`, `LeftUpperLidClosed`, `RightUpperLidClosed`, `LeftLowerLidUp`, `RightLowerLidUp`, `LeftEyeDown`, `RightEyeDown`, `LeftEyeUp`, `RightEyeUp`, `LeftEyeturnRight`, `RightEyeturnRight`, `LeftEyeturnLeft`, `RightEyeturnLeft`, `LeftCheekUp`, `RightCheekUp`, `CheeksPump`, `CheeksSuck`, `NasolabialDeepener`, `ChinLeft`, `ChinRight`, `ChinDown`, `ChinForward`, `lowerLipUp`, `lowerLipDown`, `lowerLipBackward`, `lowerLipForward`, `UpperLipUp`, `UpperLipBackward`, `UpperLipForward`, `UpperLipStretched`, `JawDrop`, `JawDropStretched`, `LipsKiss`, `MouthMoveLeft`, `MouthMoveRight`, `MouthLeftPullUp`, `MouthRightPullUp`, `MouthLeftPullSide`, `MouthRightPullSide`, `MouthLeftPullDown`, `MouthRightPullDown`, `MouthLeftPlatysma`, `MouthRightPlatysma`, `TongueOut`, `TongueUshape`, `TongueUp`, `TongueDown`, `TongueLeft`, `TongueRight`, `TonguePointUp`, `TonguePointDown`


## Materials

- **glTF metallic-roughness PBR**, nothing else required. Base colour
  textures are sRGB, PNG or JPEG, embedded.
- The creator's Babylon shading (skin scatter, hair highlights, cloth) does
  **not** travel. What it computes is baked into textures: skin albedo with
  lips and stubble, eyes drawn into an eye texture, recoloured cloth. Losing
  scatter is the honest cost; the creator keeps it.
- Fabric MAY add `KHR_materials_sheen`. Hair cards and lashes use
  `alphaMode: MASK` (with `alphaCutoff`); `BLEND` only where a mask cannot
  work. `doubleSided` where the asset says so.
- A material is named for its mesh (`body`, `garment_<asset>`).

## Licences in the file

Every asset in the file is listed, with its source and licence, in
**`asset.extras.dramatis`**. `asset.copyright` repeats it as one line for
tools that show only that: `<title>: <licence>` per asset, joined with
`; `. A CC BY asset's credit line (`attribution`) is copied word for word.

`asset.extras.dramatis` MUST match this schema (`checkExportExtras` is the
same schema in code):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://dramatis.tosijs.net/schema/export-extras-1.json",
  "type": "object",
  "required": ["format", "version", "generator", "naming", "restPose",
               "faceUnits", "character", "licences"],
  "properties": {
    "format": { "const": "dramatis-export" },
    "version": { "const": 1 },
    "generator": { "type": "string", "minLength": 1,
                   "description": "dramatis@<version>" },
    "naming": { "enum": ["ue", "mixamo"] },
    "restPose": { "enum": ["t-pose", "source"] },
    "faceUnits": { "type": "array", "uniqueItems": true,
                   "items": { "$ref": "#/$defs/faceUnit" } },
    "character": { "type": "string" },
    "licences": {
      "type": "array", "minItems": 1,
      "items": { "$ref": "#/$defs/licence" },
      "contains": { "properties": { "kind": { "const": "base" } } }
    }
  },
  "$defs": {
    "faceUnit": { "type": "string",
                  "description": "one of the 59 face units above" },
    "licence": {
      "type": "object",
      "required": ["asset", "title", "kind", "licence", "licenceUrl",
                   "source", "author"],
      "properties": {
        "asset": { "type": "string", "minLength": 1,
                   "description": "<source>:<kind>/<name>, e.g. makehuman:base/hm08" },
        "title": { "type": "string", "minLength": 1 },
        "kind": { "enum": ["base", "eyes", "eyelashes", "teeth", "tongue",
                           "brows", "beard", "hair", "garment", "texture",
                           "animation", "skin-tone", "other"] },
        "licence": { "type": "string", "minLength": 1,
                     "description": "SPDX id: CC0-1.0, CC-BY-4.0, ..." },
        "licenceUrl": { "type": "string", "minLength": 1 },
        "source": { "type": "string", "minLength": 1 },
        "author": { "type": "string", "minLength": 1 },
        "attribution": { "type": "string", "minLength": 1,
                         "description": "required for any CC BY licence" },
        "modified": { "type": "boolean" }
      }
    }
  }
}
```

An asset with no entry in the licence manifest is never exported:
`buildCharacter` throws `UnlicensedAssetError` instead.

## What VRM adds

A VRM export (`exportCharacterVrm`, `.vrm`) is this profile, always `ue`
naming and the T-pose, plus the **`VRMC_vrm` 1.0** extension (in
`extensionsUsed`):

- **`humanoid.humanBones`** maps VRM's bones to the joints: `hips` `pelvis`,
  `spine` `spine_01`, `chest` `spine_02`, `upperChest` `spine_03`, `neck`
  `neck_01`, `head` `Head`; per side `shoulder` `clavicle`, `upperArm`
  `upperarm`, `lowerArm` `lowerarm`, `hand` `hand`, `upperLeg` `thigh`,
  `lowerLeg` `calf`, `foot` `foot`, `toes` `ball`; fingers `thumbMetacarpal`,
  `thumbProximal`, `thumbDistal` on `thumb_01..03`, and `Proximal`,
  `Intermediate`, `Distal` on `index|middle|ring|pinky_01..03`. `root` and
  the `_leaf` joints are not human bones.
- **`expressions.preset`** from the face units: `blinkLeft`
  `LeftUpperLidClosed`, `blinkRight` `RightUpperLidClosed`, `blink` both, the
  visemes `aa ih ou ee oh` and the moods `happy angry sad relaxed surprised`
  as weighted sets of units (spike 3 settles the weights).
- **`lookAt`** of type `expression`, through the eye units (`LeftEyeUp`,
  `LeftEyeDown`, `LeftEyeturnLeft`, `LeftEyeturnRight` and the right's) as
  `lookUp`, `lookDown`, `lookLeft`, `lookRight`. UAL's skeleton has no eye
  joints, so look-at is by expression, not by bone.
- **`meta`**: `name`, `authors`, `licenseUrl`
  (`https://vrm.dev/licenses/1.0/`), and `otherLicenseUrl` and
  `copyrightInformation` carrying the licence entries above (which stay in
  `asset.extras.dramatis` too).

## How it is checked

`bun test test/gate1` runs six checks on every GLB in `samples/out/`: the
validator (zero errors); the skeleton's names, order and parents; the morph
targets' names; the licence block; three.js's `GLTFLoader` loading it under
Bun; and **UAL's `Walk_Loop` (Quaternius, CC0)** binding by name to the
major joints (spine, neck, head, each limb to the hand and foot) and moving
them. With nothing in `samples/out/`, every check reports **NOT RUN**.
Each check is shown able to fail on a hand-made bad file
(`test/gate1/fixtures.test.ts`). The engine imports (Babylon, Unity, Godot,
Unreal 5) are spike 1's.
