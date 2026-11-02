# Dramatis core

<!--{"parent": "docs", "order": 1, "description": "The engine-free core API (dramatis): read a character, build it, export GLB or VRM, make share links, look up licences."}-->

The `dramatis` entry is the engine-free core: no DOM, no Babylon, no
three.js. Everything here runs under plain Bun or Node and in any browser
bundle. `src/no-babylon.test.ts` bundles it for the browser and fails if
Babylon reaches the output or its types.

Install it with `npm install dramatis` (or `bun add dramatis`).

## The character file

Dramatis keeps **one character file**, `tosijs-character`, and reads and
writes it through tosijs-3d's `character-file` module. This entry re-exports
that module rather than wrapping it, so there is one implementation and one
format: `readCharacter`, `writeCharacter`, `CHARACTER_FORMAT`,
`CHARACTER_VERSION`, and the types `Character`, `CharacterDoc`,
`CharacterBody`, `ReadCharacter` and `SlotLook`.

## From a character to a file

```ts
import { loadHumanPack } from 'tosijs-3d/human-pack'
import {
  BUILD_SETTINGS,
  buildCharacter,
  exportCharacterVrm,
  HM08_PACK_URL,
  readCharacter,
  writeCharacterGlb,
} from 'dramatis'

// json: a character file's text (the creator's Save, a .character.json)
const { character } = readCharacter(json, { settings: BUILD_SETTINGS })
const pack = await loadHumanPack(HM08_PACK_URL)
const built = await buildCharacter(character, pack) // engine-free data
const glb = writeCharacterGlb(built) // Uint8Array, synchronous
const vrm = await exportCharacterVrm(character, pack)
```

| Export | What it does | Page |
| --- | --- | --- |
| `BUILD_SETTINGS` | Every setting the build reads, with its default: `readCharacter`'s `defaults.settings` (it keeps only the keys it is given) | [Export](/export/) |
| `HM08_PACK_URL` | The MakeHuman pack the creator loads, for `loadHumanPack` | [Export](/export/) |
| `buildCharacter(character, pack, options?)` | The character as engine-free data (`BuiltCharacter`): meshes, one skeleton, morphs, materials, licences | [Export](/export/) |
| `writeCharacterGlb(built, options?)` | A built character as GLB bytes, to the profile | [Export](/export/) |
| `exportCharacterGlb(character, pack, options?)` | `buildCharacter` then `writeCharacterGlb` | [Export](/export/) |
| `exportCharacterVrm(character, pack, options?)` | The same character as VRM 1.0 | [VRM](/vrm/) |
| `writeCharacterVrm`, `vrmFromGlb`, `vrmProblems`, `VRM_HUMAN_BONES`, `VRM_PRESETS` | VRM from a built character or a GLB, its check, and its tables | [VRM](/vrm/) |

## The profile's names

The export profile's names are in code as well as on the
[Export format](/export-format/) page, so a consumer can check a file
without copying tables: `UE_JOINTS` (the 65 joints and their parents),
`UE_JOINT_NAMES`, `MIXAMO_NAMES`, `jointName`, `jointNames`, `MAJOR_JOINTS`,
`FACE_UNITS` (the 59 face units), `faceUnitTarget`, and for the metadata
block `EXTRAS_KEY`, `EXPORT_FORMAT`, `EXPORT_PROFILE_VERSION` and
`checkExportExtras`.

## Licences and share links

- `licenceManifest()`, `lookupLicence(id)` and
  `characterLicences(character, pack)` give every asset's source and
  licence. A character with an asset not in the manifest throws
  `UnlicensedAssetError`.
- `encodeShareLink(character)` and `decodeShareLink(link, defaults)` put a
  character in a URL fragment and read it back (`SHARE_FRAGMENT_KEY`,
  `SHARE_LINK_VERSION`, `SHARE_LINK_BUDGET`). `defaults` are
  `readCharacter`'s: `{ settings: BUILD_SETTINGS }`.

Both are on [Licences and share links](/licences/).

## What is not here

tosijs-3d's character system (the body maths, fitting, rigging, the
creator's Babylon scene) stays in tosijs-3d. Dramatis imports its
engine-free subpaths (`tosijs-3d/human-pack`, `tosijs-3d/human-morph`, ...)
and never copies it. For three.js objects, see
[dramatis/three](/dramatis-three/).
