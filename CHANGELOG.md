# Changelog

All notable changes to Dramatis. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semver](https://semver.org/).

## [0.1.0] - Unreleased

The first drop. Not on npm yet: `package.json` is still `private` and at 0.0.0 until the owner cuts the release.

### Added

- **`dramatis`**, the engine-free core (no DOM, no Babylon, no three.js): `buildCharacter`, `writeCharacterGlb`, `exportCharacterGlb`, `exportCharacterVrm` and `writeCharacterVrm` (VRM 1.0, library only), `readCharacter`/`writeCharacter` (the `tosijs-character` file, through tosijs-3d), share links (`encodeShareLink`/`decodeShareLink`), the licence manifest (`licenceManifest`, `characterLicences`, `UnlicensedAssetError`), and the GLB profile's names (`MIXAMO_NAMES`, `UE_JOINT_NAMES`, `FACE_UNITS`).
- **`dramatis/three`**, the three.js embed (`three` is an optional peer): `characterObject`, `updateCharacterObject`, `characterClip`, `bodyGeometry`, `morphedBodyGeometry`.
- **The creator** (`/creator/` on dramatis.tosijs.net): shape and dress a MakeHuman body, then Download GLB, View in three.js, or make a Share link.
- **The three.js viewer** (`/viewer/`): opens any GLB, plays Quaternius' UAL clips by name, drives the face units, and lists the licences the file carries.
- Every exported asset carries its licence in the GLB's extras; MakeHuman's CC0 data only, reimplemented from the file formats.

### Engines

Checked on the four samples in `samples/out/`, headless, default import settings ([reports/spike-1.md](reports/spike-1.md)). Export is the launch gate, so read this list before relying on an engine.

- **three.js 0.186: verified.** Gate 1 (`bun run gate1`) and the viewer in headless Chromium.
- **Godot 4.5: verified.** Headless import and checks (32/32), rendered frames.
- Babylon.js 9.33: checked on a `NullEngine` only (28/28, nothing rendered).
- Blender 5.2: checked (28/28), as a second opinion; no guide.
- **Unity: not run.** No Unity editor was installed. The sample project and batch script are written and have never executed.
- **Unreal 5: secondary, not run.** A manual procedure is written; nothing has been imported.

Not judged yet: how a character looks on a real GPU, VRM in a VTuber app, browsers other than Chromium. Known export gaps (no baked skin or eye textures, Quaternius hair does not export, shoe soles below the floor) are on the Export page.

### Size

Library build, unminified ESM: `dist/index.js` 140 KB (30 KB gzip), `dist/three/index.js` 13 KB (3.7 KB gzip), and a 6.5 KB shared chunk. The baseline is in `dist-sizes.json`; the build prints the delta against it.
