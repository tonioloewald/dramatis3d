# Export

<!--{"parent": "docs", "order": 3, "description": "How a character leaves Dramatis as one GLB: the options, what happens to the body, clothes, face, rest pose, materials and licences, and the known gaps."}-->

A character leaves Dramatis as one **GLB** file that any engine opens with no
fixes: a skinned body and everything it wears on one skeleton, the face as
morph targets, plain PBR materials, and the licence of every asset inside the
file. The profile it follows is normative and lives on its own page:
[Export format](/export-format/).

```ts
import { loadHumanPack } from 'tosijs-3d/human-pack'
import {
  BUILD_SETTINGS,
  exportCharacterGlb,
  HM08_PACK_URL,
  readCharacter,
} from 'dramatis'

// json: a character file's text (the creator's Save, a .character.json)
const pack = await loadHumanPack(HM08_PACK_URL)
const { character } = readCharacter(json, { settings: BUILD_SETTINGS })
const glb = await exportCharacterGlb(character, pack) // Uint8Array
```

`BUILD_SETTINGS` is every setting the build reads, with its default:
`readCharacter` keeps only the keys it is given, so pass all of them.
`HM08_PACK_URL` is the MakeHuman pack the creator loads.

`exportCharacterGlb` is `buildCharacter` then `writeCharacterGlb`. Build once
and write as often as you like (`writeCharacterGlb` is synchronous): the
built character is engine-free data, the same shape the
[three.js embed](/dramatis-three/) draws.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `naming` | `'ue'` | Joint names: UE mannequin as UAL spells them, or `'mixamo'` |
| `restPose` | `'t-pose'` | The bind pose: UAL's T-pose, or `'source'` (MakeHuman's arms-down rest) |
| `faceUnits` | `true` | All 59 face units as morph targets, `false` for none, or a list |
| `fetch` | `fetch` | How textures are read (a cache, a worker, a test) |

A `naming` or `restPose` that is not one of its two values (`'UE'`,
`'T-Pose'`) is an error naming the allowed values, from `buildCharacter`,
`writeCharacterGlb` and `exportCharacterGlb` alike, before anything is
built: it is never taken as the other value.

## What happens to a character

1. **The body** is MakeHuman's hm08 base morphed to the character's sliders.
   UAL's 65-joint skeleton is placed inside it from MakeHuman's joint cubes
   and the skin is bound by bone heat (tosijs-3d's `humanBodyMaker`).
2. **What it wears** (clothes, shoes, hair, brows, beard, and the teeth and
   tongue every character has) is fitted to that body by its MakeHuman
   binding, then skinned to the **same skeleton** with weights borrowed from
   the skin under it, so clothing deforms with the body.
3. **Covered skin is removed**: skin a garment lists is dropped where it is
   wholly covered, and the skin under clothes is tucked in a few millimetres
   so it cannot poke through, faded in from each garment's edge.
4. **The face units are baked as morph targets**, named exactly as MakeHuman
   names them (`JawDrop`, `LeftUpperLidClosed`, ...), on every mesh they move:
   the body, lashes, brows, teeth, tongue, eyes. One name on several meshes
   is one unit: drive them together.
5. **The rest pose is UAL's T-pose with UAL's own joint frames.** MakeHuman
   stands with its arms angled down; the export lays each arm, hand, finger
   and leg bone along UAL's, skins every mesh there once, and gives every
   joint UAL's rest rotation. That is why **UAL's clips play on an export by
   name, unretargeted**: play their rotation tracks on every joint and their
   translation tracks on `root` and `pelvis` only.
6. **Materials are plain glTF PBR.** The skin's colour comes from the Monk
   Skin Tone Scale (credited in the file); each garment, hair and brow keeps
   its own texture, hair and lashes cut out (`MASK`). The creator's skin and
   hair shading does not travel.
7. **Licences travel in the file**: every asset's source and licence in
   `asset.extras.dramatis`, and as one line in `asset.copyright`. An asset
   with no licence entry is never exported: the build throws
   `UnlicensedAssetError` instead.

The character stands on the floor at the origin, facing +Z, its left hand on
+X, in metres.

## Samples

`samples/out/` holds exported characters, written by
`bun bin/export-sample.ts`, each with the character file it was made from:

- `clothed-casual.glb`: a man in a casual suit and shoes, short hair;
- `long-hair.glb`: a woman with long hair and a sports suit, darker skin;
- `extreme-heavy.glb`: every body slider at its extreme (oldest, heaviest,
  most muscular, tallest), in a work suit;
- `clothed-casual-mixamo.glb`: the first, with Mixamo joint names.

Gate 1 (`bun run gate1`) checks each against the profile: the Khronos glTF
validator, the skeleton, the morph names, the licences, three.js's loader,
and UAL's `Walk_Loop` (CC0) playing on it by name. To look at one without a
GPU, `bun src/build/preview.ts <file.glb> <out.png> [walk 0..1] [front|side]`
draws it posed on the CPU.

## Not yet

These are known gaps, each tracked on the board:

- **Baked textures.** The skin is one colour (no lips, no stubble) and the
  lashes a dark opaque card; garment normal maps and colour recipes do not
  travel yet. (The eyes are textured, in the character's eye colour.)
- **Quaternius hair and brows**, garments of the character's own, and mesh
  bodies other than MakeHuman's: `buildCharacter` throws, saying which (the
  creator offers Quaternius hair, so its export stops there).
- A hat pushing the hair under it.
- **Shoes go below the floor.** The body is grounded on its whole skin,
  then the skin under shoes is cut away, and a shoe's sole ends up below
  y = 0:
  2.6 mm on `clothed-casual`, 10.6 mm on `long-hair`, 36.3 mm on
  `extreme-heavy` (`reports/spike-1.md`, finding 6).

**VRM** is the same export plus one extension: see [VRM](/vrm/).

## Where it has been checked

The samples have been imported into three.js, Godot 4.5, Babylon.js 9.33
(headless) and Blender 5.2 with default settings and no fixes. Unity and
Unreal 5 have not been run. The [docs index](/docs/) has the table, and
each engine's guide says what was checked.
