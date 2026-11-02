# Changelog

All notable changes to Dramatis. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semver](https://semver.org/).

## [0.1.0] - 2026-11-02

The first release: make a character in the browser, export it, and it works in three.js, Unity and Godot. Live at [dramatis.tosijs.net](https://dramatis.tosijs.net).

### Added

- **`dramatis`**, the engine-free core (no DOM, no Babylon, no three.js): `buildCharacter`, `writeCharacterGlb`, `exportCharacterGlb`, `exportCharacterVrm` and `writeCharacterVrm` (VRM 1.0, library only), `readCharacter`/`writeCharacter` (the `tosijs-character` file, through tosijs-3d), share links (`encodeShareLink`/`decodeShareLink`), the licence manifest (`licenceManifest`, `characterLicences`, `UnlicensedAssetError`), and the GLB profile's names (`MIXAMO_NAMES`, `UE_JOINT_NAMES`, `FACE_UNITS`).
- **`dramatis/three`**, the three.js embed (`three` is an optional peer): `characterObject`, `updateCharacterObject`, `characterClip`, `bodyGeometry`, `morphedBodyGeometry`.
- **The creator** (`/creator/`): shape and dress a MakeHuman body, then Download GLB, View in three.js, or make a Share link. Characters are kept in the browser (save… and rename… ask for the name), and exported or imported as `tosijs-character` files (.json).
- **Eyes**: Tonio Loewald's eye art (CC0, served from cdn.tosijs.net), basic or anime (**eye art** in the creator, `eyeStyle` in the file), its iris recoloured to the character's eye colour. The creator shows the same eyes it exports.
- **The three.js demo** (`/demo/`): walk a character round a small scene, with UAL's idle, walk, jog and sprint loops: a character saved in this browser (built in the page), or a GLB, VRM or character file you open.
- **The Unity player** (`/unity/`): the same walk-round in Unity 6's Web player, the export loaded at runtime with glTFast.
- **The three.js viewer** (`/viewer/`): opens any GLB, plays Quaternius' UAL clips by name, drives the face units, and lists the licences the file carries.
- Every exported asset carries its licence in the GLB's extras; MakeHuman's CC0 data only, reimplemented from the file formats.

### Engines

Checked on the four samples in `samples/out/`, with default import settings ([reports/spike-1.md](reports/spike-1.md)). Export is the launch gate, so read this list before relying on an engine.

- **three.js 0.186: verified.** Gate 1 (`bun run gate1`), the viewer and the demo in headless Chromium.
- **Unity 6 (6000.6), glTFast 6.14: verified.** Batch import and checks (28/28): skeleton, skinning at rest, the 59 face units as blend shapes, a valid Humanoid avatar under UE or Mixamo naming, UAL's walk. The Web player is built from the same project.
- **Godot 4.5: verified.** Headless import and checks (32/32), rendered frames.
- Babylon.js 9.33: checked on a `NullEngine` only (28/28, nothing rendered).
- Blender 5.2: checked (28/28), as a second opinion; no guide.
- **Unreal 5: secondary, not run.** A manual procedure is written; nothing has been imported.

Not judged yet: VRM in a VTuber app, browsers other than Chromium. Known export gaps: the skin is one flat colour (no lips or stubble), the lashes export as a dark opaque card, Quaternius hair does not export, garments of the character's own (the tailor) do not export, shoe soles sit below the floor. See the Export page.

### What the export fetches

`buildCharacter` reads the MakeHuman pack, its textures and the eye art from cdn.tosijs.net (`BuildOptions.fetch` to point it elsewhere). Those folders are open to any site.

### Inside, for now

`src/upstream/` holds work bound for tosijs-3d (the skinned GLB writer, the slider-extremes sweep, eye baking). It is internal, not part of the API, and moves into tosijs-3d as it lands there (tosijs-3d #3647, #3653, #3732).

### Size

Library build, unminified ESM: `dist/index.js` 140 KB (30 KB gzip), `dist/three/index.js` 13 KB (3.7 KB gzip), and a 6.5 KB shared chunk. The baseline is in `dist-sizes.json`; the build prints the delta against it.
