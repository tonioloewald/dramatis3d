# Unity

<!--{"parent": "docs", "order": 13, "description": "Verified in Unity 6: importing a Dramatis GLB with glTFast, building a Humanoid avatar, and playing UAL clips."}-->

**Verified in Unity 6** (6000.6.7f1, glTFast 6.14.1, 2026-11-02): every
sample export imports with glTFast's defaults and no fixes, makes a valid
Humanoid avatar (UE or Mixamo naming) and plays UAL's walk. The run is
`bun tools/engines/unity.ts` on [`samples/unity`](https://github.com/tonioloewald/dramatis3d/tree/main/samples/unity); its evidence is in
`reports/spike-1.md`. Unity's automatic avatar mapping in the editor
window was not tried: the check maps the bones explicitly, as below.

**Try it:** the [Unity player](/unity/) is the three.js demo's walk-round
in Unity's Web player, loading your export at runtime with glTFast (the
creator's **View in Unity** button sends it there). That
is glTFast's runtime path, with legacy clips; a game in the editor would
more often use the editor import and a Humanoid avatar, below.

## How the Unity player works

The [Unity player](/unity/) is a small, readable Unity project you can copy:
[`DramatisPlayer.cs`](https://github.com/tonioloewald/dramatis3d/blob/main/samples/unity/Assets/Dramatis/Runtime/DramatisPlayer.cs)
loads the export and UAL's clips with glTFast at runtime and walks the
character round, and [`site/unity/main.ts`](https://github.com/tonioloewald/dramatis3d/blob/main/site/unity/main.ts) is the
page around it (it builds the GLB in the browser and hands it over). Getting
a Dramatis character right in Unity took four things, each of which you
will meet in your own project:

- **Play only the clip's rotations.** UAL's clips carry UAL's own bone
  offsets and scales on every joint. Played as they are, they move the
  spine, clavicles and neck to where UAL's body has them, and the character
  hunches. The player keeps each joint's own rest offset and scale, and
  takes only the rotations from the clip, plus the hips' travel, scaled to
  the character's hip height. This is what `splice-clip` (below) bakes into
  a file, and what `characterClip` does in three.js.
- **A blend shape's full weight is 1, not 100.** glTFast imports morph
  targets with a frame weight of 1, where Unity's own importers use 100.
  Setting a face unit to 100 moves it a hundred times too far (the player's
  blink once dragged the face to the waist). Read the weight with
  `mesh.GetBlendShapeFrameWeight(index, 0)` and scale to it.
- **Skin with four bones a vertex.** The export carries four influences per
  vertex. Unity's default quality levels for WebGL and mobile skin with two,
  which creases shoulders and hips. Set **Quality > Skin Weights** to four
  bones (the player sets `QualitySettings.skinWeights`).
- **Bounds:** set `updateWhenOffscreen` on each `SkinnedMeshRenderer`, or
  the bind-pose bounds cull the character once it walks away from them.

## Import with glTFast

Unity reads GLB through **glTFast** (`com.unity.cloud.gltfast`), Unity's own
glTF package. Add it in Package Manager (Add package by name) or in
`Packages/manifest.json`:

```json
{ "dependencies": { "com.unity.cloud.gltfast": "6.14.1" } }
```

Then drop the `.glb` into `Assets/`. glTFast makes a prefab: one
`SkinnedMeshRenderer` per part (`body`, `eyes`, `hair`, `garment_<asset>`,
...), all sharing one 65-bone skeleton, with the face units as blend
shapes. glTFast mirrors X to go from glTF's right-handed axes to Unity's
left-handed ones; the character stands on the floor facing +Z.

## Humanoid

glTFast does not offer Unity's Humanoid rig type in its import settings, so
build the avatar from the skeleton in code with `AvatarBuilder`. The bone map
is fixed by the export profile (UE mannequin names, or their Mixamo
equivalents):

| Unity `HumanBodyBones` | Dramatis joint |
| --- | --- |
| Hips, Spine, Chest, UpperChest, Neck, Head | `pelvis`, `spine_01`, `spine_02`, `spine_03`, `neck_01`, `Head` |
| Left/Right Shoulder, UpperArm, LowerArm, Hand | `clavicle_l/r`, `upperarm_l/r`, `lowerarm_l/r`, `hand_l/r` |
| Left/Right UpperLeg, LowerLeg, Foot, Toes | `thigh_l/r`, `calf_l/r`, `foot_l/r`, `ball_l/r` |
| Fingers Proximal, Intermediate, Distal | `thumb|index|middle|ring|pinky_01..03_l/r` |

`root` and the `_leaf` tips are not human bones. The complete builder is
`BuildHumanoid` in `samples/unity/Assets/Editor/DramatisEngineCheck.cs`.
The export's rest pose is a T-pose, which is what Humanoid expects.

With a Humanoid avatar, any Humanoid clip (Mixamo's, the Asset Store's)
drives the character through Unity's retargeting.

## UAL and other UE-mannequin clips

The skeleton has the rest frames of Quaternius' Universal Animation
Library, so UAL clips play on it as Generic clips with no retargeting, as
long as their curve paths match the character's hierarchy. The simplest way
is to put the clip into the character's own file:

```sh
bun tools/engines/splice-clip.ts hero.glb hero.walk.glb   # UAL Walk_Loop by default
```

`hero.walk.glb` imports with its clip on the character's own joints
(rotations on every joint, translations on `root` and `pelvis` only, the
pelvis scaled to the character's hip height). If glTFast makes no clip, set
the importer's **Animation** to *Legacy* or *Mecanim* in the Inspector.

## Run the check

```sh
bun tools/engines/unity.ts
```

copies the sample exports into `samples/unity/Assets/Characters/` and runs
the editor in batch mode (exact command and steps:
`samples/unity/README.md`).
