# Spike 1: round trip in the engines

**Question** (PLAN.md, spike 1): does an exported character import into
three.js, Babylon, Unity, Godot and Unreal 5 with no manual fixes, and play
a third-party animation there? Record what breaks per engine.

**Run:** 2026-11-02, on `work/engines` (base `work/fit`, 9b30143), macOS
arm64, Bun 1.4.2. Inputs: the four committed samples in `samples/out/`
(`clothed-casual`, `clothed-casual-mixamo`, `extreme-heavy`, `long-hair`;
written by `bin/export-sample.ts` with the real licence manifest) and UAL's
`Walk_Loop` (Quaternius, CC0) from `test/gate1/fixtures/ual-walk.glb`.

| Engine | Version | Status | Result |
| --- | --- | --- | --- |
| three.js | 0.186 (GLTFLoader, AnimationMixer) | ran (gate 1) | 24/24 checks pass on 4 exports |
| **Godot** | 4.5.stable | **ran, headless import + check** | **32/32 pass** on 4 exports; rendered |
| Blender (second opinion) | 5.2.0 LTS | ran, background | 28/28 pass on 4 exports |
| Babylon.js | 9.33.1 (NullEngine under Bun) | ran | 28/28 pass on 4 exports |
| **Unity** | 6000.6.7f1, glTFast 6.14.1 | **ran, batch mode** (2026-11-02) | **28/28 pass** on 4 exports; Humanoid valid; Web player built |
| Unreal 5 | none installed | **NOT RUN** | instructions only (secondary) |

`reports/spike-1/results.json` is the machine-readable run (every check's
evidence); `reports/spike-1/godot-*.png` are frames rendered by Godot.

**Answer so far:** in every engine that ran, the exports import with
default settings and no fixes, the skeleton maps by name, the face units
arrive as blend shapes, and UAL's walk moves the bones and the skin
(clothes included). Unity, the owner's priority target, ran on 2026-11-02
and passes too (below), so the three initial targets (three.js, Unity,
Godot) are all verified. Six findings below, none blocking, three of them
for the writer.

## How to rerun

```sh
bun tools/engines/run.ts --json reports/spike-1/results.json --render reports/spike-1
DRAMATIS_ENGINES=1 bun test tools/engines      # the same, as tests
bun tools/engines/godot.ts | blender.ts | babylon.ts   # one engine
bun tools/engines/unity.ts                     # Unity: needs the editor
bun run gate1                                  # three.js
```

Each check starts from the engine's **default** import. Nothing in a
character's import settings is changed. Where an engine's renderer cannot
run headless (Godot's dummy renderer, Babylon's NullEngine), skinning is
computed on the CPU from the engine's own bone and bind matrices, and the
renderer path is covered by the Godot frames below.

## Per engine

### three.js (gate 1)

`bun run gate1` on this branch: **43 pass, 0 fail** (the 6 profile checks
on each of the 4 exports, plus the harness's own 19 fixture tests).
GLTFLoader loads each as a `SkinnedMesh` set; `Walk_Loop`, renamed to the
export's naming, binds to all 20 major joints and moves them. Nothing new
here; see `test/gate1/`.

### Godot 4.5 (`tools/engines/godot.ts`, `samples/godot/`)

What ran: `Godot --headless --path samples/godot --import` (the editor's
default glTF import of each export and of UAL's clip), then
`Godot --headless --script res://scripts/check.gd`. Then the real renderer
(`--write-movie`, a window) for one frame per character.

Passed on all four exports (8 checks each):

- **import**: each GLB becomes a PackedScene: `Node3D > Skeleton3D >`
  nine `MeshInstance3D` (body, eyes, eyelashes, teeth, tongue, brows, hair,
  each garment).
- **skeleton**: 65 bones, profile names and parents.
- **axes**: metres, Y up, left hand on +X, toes on +Z, `root` at the
  origin. E.g. clothed-casual: Head (0, 1.586, 0.046), hand_l
  (0.706, 1.384, 0.015).
- **skins**: every mesh has a Skin on the one Skeleton3D; every bind
  resolves to a bone.
- **rest-skinning**: CPU linear-blend skinning at rest moves no vertex by
  more than 0.11 mm (12,070 to 12,478 vertices sampled per character; the
  0.1 mm is Godot's import-time vertex compression; Blender and Babylon
  read 0.0006 mm).
- **morphs**: all 59 face units as blend shapes across the meshes (body
  51, tongue 35, brows 33, hair 27 or 24, eyes 19, eyelashes 14, teeth 7,
  the top garment 7); `set_blend_shape_value` works; `JawDrop` moves the
  body 32.2 mm (read through Godot's `GLTFDocument`, since the headless
  renderer keeps no blend shape data).
- **materials**: `StandardMaterial3D` on every surface; textured parts
  1024x1024; hair, brows, teeth alpha-scissor 0.40.
- **clip**: UAL's file imported by Godot, its tracks pointed at the
  character's `Skeleton3D` by bone name (`samples/godot/scripts/main.gd`,
  the same code the sample plays). 67 of 195 tracks kept (rotations
  everywhere, positions on root and pelvis, the pelvis's scaled by the
  hips' heights); all 20 major joints bound. Over the clip: limbs turn
  46 to 83 degrees; head, hands and feet travel (clothed-casual: Head 8.6,
  hands 71, feet 40 cm); the 50 body vertices most weighted to `hand_l`
  travel up to 84 cm and stay within 3 to 6 mm of the hand's frame; the
  ankles never drop below their rest height (lowest -0.2 cm).

Rendered (`reports/spike-1/godot-*.png`, frame 20 of the walk, Godot's
Mobile renderer, one directional light): each character walks, clothes
follow the legs and arms, hair stays on the head. **Looks wrong:** the eyes
are blank white (no iris, finding 4), and `extreme-heavy`'s skin is a flat
untextured tone.

### Blender 5.2 (`tools/engines/blender.ts`, `blender_check.py`)

What ran: `Blender --background --factory-startup --python`; each export
imported with Blender's bundled glTF importer at its defaults into an
empty scene. Passed on all four (7 checks each): one armature of 65 bones
with the profile's names and parents (Mixamo's `:` kept); every mesh has an
Armature modifier and vertex groups that are bones; no vertex has more than
4 weights and all sum to 1 (19,754 to 22,860 vertices); 59 face units as
shape keys, `JawDrop` 32.2 mm; rest-pose evaluation drifts 0.0006 mm;
turning `upperarm_l` 45 degrees moves the hand 40 to 64 cm and the head
0.000 mm (weights are where they belong); `Walk_Loop` plays and the hands'
skin travels 70 to 114 cm.

Blender cannot take UAL's clip file directly: the file has no skin, so
Blender imports its joints as Empties with object animation, not an
armature action. The check therefore plays the clip from a copy of the
export with UAL's keys spliced onto its own joints by name
(`tools/engines/splice-clip.ts`; validator-clean, and tested to play in
three.js). That tests Blender's reading of the export's skeleton and a glTF
animation on it, not a Blender retargeting workflow.

### Babylon.js 9.33 (`tools/engines/babylon.ts`)

What ran: `@babylonjs/loaders` glTF loader on a `NullEngine`, under Bun,
textures not decoded. Passed on all four (7 checks each): 9 meshes on one
skeleton of 65 bones (names kept, `:` included), parents right; every mesh
skinned; CPU skinning with Babylon's own bone matrices drifts 0.0004 mm at
rest; 59 face units as morph targets, `JawDrop` 32.2 mm; `PBRMaterial` on
every mesh; UAL's `Walk_Loop` loaded by the same loader and cloned onto the
character's bone nodes with `AnimationGroup.clone` binds all 20 major
joints, turns the limbs and moves the hands' skin 61 to 149 cm.

This check plays UAL's pelvis keys **unscaled**, as gate 1 does: on
`extreme-heavy` (head at 2.23 m) the head travels 55.5 cm instead of 11 cm,
i.e. the body sinks to the mannequin's hip height (finding 3).

### Unity: ran, 28/28 (2026-11-02)

Unity 6000.6.7f1 (Unity 6.6) with glTFast 6.14.1, batch mode on macOS:
`bun tools/engines/unity.ts`. Every export imports with glTFast's defaults
and no fixes. Per export (evidence in `reports/spike-1/unity-results.json`):

- **import:** 9 skinned meshes (body, eyes, lashes, teeth, tongue, brows,
  hair, garments); **skeleton:** 65 bones, root `root`; **axes:** head at
  1.59 m, Y-up, facing +Z.
- **rest skinning:** `BakeMesh` at rest matches the mesh to 0.001 mm.
- **morphs:** all 59 face units as blend shapes; JawDrop moves the jaw 32 mm.
- **humanoid:** `AvatarBuilder` with the profile's bone map makes a valid,
  human avatar (52 bones, no T-pose fix-up) under **both** namings. So
  "does Unity Humanoid need Mixamo naming?" is answered: no, given an
  explicit map (`samples/unity/Assets/Editor/DramatisEngineCheck.cs`).
  Unity's automatic mapping in the editor's Avatar window was not tried.
- **clip:** UAL's `Walk_Loop` moves the hands 59-98 cm and the feet 33-61 cm
  over the loop; the baked skin follows; the Humanoid muscles change by up
  to 1.2.

The first run needed no changes to the check. Unity rewrote
`Packages/manifest.json` with its template's packages; it is trimmed back to
glTFast and the modules the project uses.

**The Web player** (`bun tools/engines/unity.ts --web`, the site's
[/unity/](https://dramatis.tosijs.net/unity/)) also built on its second
try (the first failed on an asset folder the build script made on disk
without telling the AssetDatabase). In headless Chromium it loads the
default character built in the page, binds idle, walk, jog and sprint
(glTFast's runtime legacy clips, by path), walks on W and stops: 6.5 MB of
player, about 7 s to a walking character.

### Unreal 5: NOT RUN

Secondary target. Procedure in `site/docs/guide-unreal.md` (Interchange
import with morph targets, UAL clips via a shared or compatible skeleton,
UE5 Manny clips via the IK Retargeter, what to record).

## Findings

1. **Mixamo naming is renamed by Godot.** Godot forbids `:` in bone names
   and turns all 64 `mixamorig:X` into `mixamorig_X` (three.js strips the
   `:`, Blender and Babylon keep it). Clips still bind if looked up by the
   engine's spelling; the guide says so. No change to the profile
   proposed: Mixamo's own files have the same issue.
2. **The UE naming needed no fix anywhere that ran.** UAL clips bind by
   name in three.js, Godot, Babylon and Blender. Nothing seen tonight argues
   for Mixamo as the default (PLAN.md, "Default skeleton naming"); Unity
   decides it.
3. **UAL's pelvis translation must be scaled.** Played unscaled (gate 1,
   the Babylon check), a character much taller or shorter than the
   mannequin sinks or floats: `extreme-heavy`'s head travels 55 cm instead
   of 11. Scaled by the hips' heights (the Godot sample,
   `splice-clip.ts`), the ankles stay within 0.2 cm of their rest height.
   The profile already says "ideally"; the samples should all do it.
4. **Eyes and body are untextured** (`eyes` a flat `#ededea`, `body` a flat
   tone, no `TEXCOORD_0` on body, eyes or eyelashes). In Godot the eyes
   render as blank white balls. This is the baked-materials work (PLAN.md,
   spike 2), for the skinned-glb lane.
5. **Godot logs `UVs are required to generate tangents`** once per blend
   shape on the UV-less meshes: 84 per export, 336 for the four. The import
   still succeeds. Goes away with finding 4 (body UVs), or the writer could
   emit `TANGENT`.
6. **Shoes go below the floor.** The lowest vertex of each export is a
   shoe sole at y = -2.6 mm (clothed-casual), -10.6 mm (long-hair) and
   -36.3 mm (extreme-heavy). With the feet under shoes cut from the body
   (`coverBody`), the body's lowest skin is 15.9 cm up, so the profile's
   "the lowest point of the body's skin is at y = 0" is no longer what puts
   the character on the floor. For the skinned-glb lane: ground on the
   lowest skinned vertex of any mesh (or on the uncovered sole), and the
   profile's sentence needs that wording.

Engine behaviours to know (documented in the guides, not bugs):

- Godot imports a clip named `Walk_Loop` as `Walk`, looping (it reads the
  `_Loop` suffix), and by default drops tracks that hold a bone still
  (`spine_01` in the walk). Harmless on our skeleton, since the held value is
  the shared rest; the sample turns it off for the clip.
- Blender's importer adds an `Icosphere` object (the bones' display shape)
  next to the meshes.

## What is not covered

- Unity and Unreal (above).
- Visual checks in three.js, Babylon and Blender (no renders tonight; only
  Godot rendered). "Looks right under default lighting" is judged on the
  Godot frames only.
- The VRM export (no VRM lane output yet).
- Babylon's and Godot's GPU skinning paths are only seen through the Godot
  frames; the numeric skinning checks are CPU recomputations from each
  engine's matrices.
