# Unity (draft)

<!--{"parent": "docs", "order": 13, "description": "Draft, not verified: importing a Dramatis GLB into Unity with glTFast, building a Humanoid avatar, and playing UAL clips."}-->

**Draft. Not yet verified in Unity.** The steps below and the sample project
(`samples/unity`) were written for spike 1 without a Unity editor at hand;
its C# has never been compiled. They run in batch mode the first time an
editor is installed. This page changes with what that run finds
(`reports/spike-1.md`).

## Import with glTFast

Unity reads GLB through **glTFast** (`com.unity.cloud.gltfast`), Unity's own
glTF package. Add it in Package Manager (Add package by name) or in
`Packages/manifest.json`:

```json
{ "dependencies": { "com.unity.cloud.gltfast": "6.10.1" } }
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
