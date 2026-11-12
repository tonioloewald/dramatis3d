# Changelog

All notable changes to Dramatis. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semver](https://semver.org/).

## [Unreleased]

## [0.1.3] - 2026-11-12

Mesh bodies, clips and a held item in the export, a starter wardrobe, VRM from the creator, and the creator's tabs and undo. New public API (below); nothing removed. On tosijs-3d 0.12.6.

### Added

- **Bring your hero: mesh bodies** (#3856). A character's body can be MakeHuman's, one of the AI cast (Keisha and Kevin, in underwear and spacesuits; CC0, Tonio Loewald's), or a mesh file of your own, rigged in tosijs-3d's rig tool. `exportCharacterGlb` and `exportCharacterVrm` export it to the same profile: CC0 with its provenance for the cast, `NOASSERTION` for your own file. A mesh body has no face units, garments or real height. Gate 1 runs on four cast samples (`samples/out/mesh-*.glb`).
- **Clips in the export** (#3908). `ExportOptions.clips` writes clips into the GLB, retargeted onto the character, each with its licence among the file's; `ualClips` makes them from UAL's file (`UAL_CLIPS_LICENCE`, type `ExportClip`). In the creator, the Motion tab's "in exported GLBs" toggles, kept in the character file and share links. VRM carries none. Gate 1 checks that a file's own clips are licensed, bind and move in three.js (sample `with-clips`).
- **Held items** (#3909). `ExportOptions.held` puts an item in the right hand: a `weapon_r` joint under `hand_r`, after the profile's 65, with the item's mesh skinned to it and its licence among the file's. `weaponHeld` makes one from Tonio Loewald's weapon library (CC0, 12 items: `WEAPONS`, `WEAPONS_PATH`, type `ExportHeld`). The socket and the item are placed by tosijs-3d's `heldParts` (0.12.6), the same code its own writer uses. In the creator, a Hold tab with a grip per kind of item; undo and share links keep it. Each item adds about 7 MB (the library's shared textures). VRM carries none. Sample `with-held`.
- **The creator: a tab per section, and undo/redo** (#3892, #3898). tosijs-3d's icons on the tabs, undo and redo on the panel's icon bar (⌘Z, ⇧⌘Z). Body's sliders are grouped: vital stats (the skeleton), shape (fitness, and the bust) and ancestry.
- **Seven MakeHuman body proxies** (pack v18, CC0), in the licence snapshot and page.
- **Download VRM in the creator:** saves the character as a VRM 1.0 avatar for VTuber apps and VRM viewers, with its licences inside. A browser test clicks it and checks the file (structural VRM check, licences). Run in VCam (a macOS VTuber app): it loads, looks right and tracks.
- **The home page has a picture:** an engraving of a stage company, as WebP at three widths (105 to 290 KB; the browser picks one), credited on the licences page.
- **A starter wardrobe of 14 CC0 garments** from MakeHuman's community asset packs: two t-shirts, a fisherman sweater, a bodice top, wool trousers, cargo trousers, denim shorts, a dinner suit, a bodysuit, flats, T-bar and cloth shoes, short gloves and a cloche hat. Each was checked one by one (the pack page, the pack's metadata and the garment's own file all say CC0) and each holds up in the slider-extremes sweep, or misses on a few bodies by under 9 mm. Three candidates whose own files say AGPL3 (two mini skirts and a newsboy cap) are left out. Before this the creator offered four garments that held up.

### Changed

- **tosijs-3d 0.12.6, pinned** (from 0.12.1, through 0.12.2 to 0.12.5). Babylon is an optional peer of tosijs-3d. Dev dependencies refreshed (#3900). 0.12.6 moves the marker rigs' pelvis, neck and knees to where UAL's mannequins have them, so the mesh samples' rigs changed, and its clip baking keeps a planted foot on the floor (foot IK), so exported clips changed too.
- **The core is bigger: `dramatis` is 82.5 KiB gzip** (with tosijs-3d's subpaths bundled), up from 43.4 KiB on 2026-11-03. Mesh bodies brought tosijs-3d's GLB reader, rig fit, bone heat and rigged-body writer (about 17 KiB); that writer grew with garments, clips and held items (about 7 KiB), and in 0.12.6 with garment baking, which reaches a JPEG decoder Dramatis's exports don't use (about 5 KiB; asked of tosijs-3d to load on demand); clips and held items here about 6 KiB. Its ceiling in `src/size.test.ts` went from 50 to 86 KiB in four steps, each with its reason there.
- **A profile addition: `weapon_r`** (owner, 2026-11-10). A GLB may carry one socket joint, `weapon_r` (or `weapon_l`), as the skin's last joint, after the 65, under its hand. The format stays version 1: a v1 reader takes the 65 by name and may ignore what follows them (export-format.md, "Versions").
- **The creator warns phone and tablet visitors while it loads:** the first visit is a large download (about 20 MB), and it works best on a desktop or a recent flagship phone. The creator page says the same.
- **The eye art and the slider-extremes sweep are tosijs-3d's** (since 0.12.2). Exports recolour and map the eyes with `tosijs-3d/eye-art` (#3727); `bin/extremes.ts` runs `tosijs-3d/fit-extremes` (#3661). Dramatis's copies in `src/upstream/` are gone, and with them the last code bound for tosijs-3d. The samples' eye textures are pixel-identical; tosijs-3d's PNG encoder writes them about 6 KB larger.
- **The GLB writer is tosijs-3d's.** Exports are written by `tosijs-3d/skinned-glb` and read by `tosijs-3d/glb-chunks` (in tosijs-3d since 0.12.1, the version already pinned); Dramatis's copy in `src/upstream/glb/` is gone. The four sample exports are byte-identical, and `dramatis` is 4.6 KB gzip smaller.

### Fixed

- **The export pages listed Unity as not run.** It ran in spike 1 (28 of 28); only Unreal 5 is unverified.
- **A share link marked version 0 is refused** instead of being read as version 1 (no such link was ever made). The export format page now says what raises its version and how a reader treats a newer file (#3690).
- **The docs' TypeScript samples typecheck** (#3676). `site/docs/fences.test.ts` checks every ```ts fence against the library's source, in `bun run check`; it found three fences missing three.js imports (`AnimationMixer`, `Mesh`, `Vector3`) and an untyped face-unit helper, now fixed. The site's own example check is on too.
- **The licences page says what of your own exports** (#3675): your own garments are refused, and your own mesh body, rigged in the rig tool, exports as `NOASSERTION`. A test ties the sentence to what the exporter does.
- **The Unity player hunched the character** (shoulders up, the neck short, the spine out of line). It played UAL's clips as they are, so every joint took UAL's bone offsets and scales, not the character's own. Now only the rotations, and the hips' travel, come from the clip, as in `dramatis/three` and `splice-clip`.
- **The Unity player's blink tore the face down to the waist.** glTFast imports a morph target at full weight 1, not Unity's usual 100, and the player blinked at 100: every 3.7 s the lids moved 100 times over. The blink now scales to each shape's own full weight.
- **The Unity player skinned with two bones a vertex** (WebGL's default quality), creasing the shoulders and hips; it now asks for four, which is what the export carries.
- **The three.js viewer opens the jaw only a touch** (JawDrop 0.05, was 0.35), so a loaded character's face rests.
- **A phone budget, held in CI** (#3654, #3670). `tools/perf/phone.test.ts` loads each page on a 4x-slowed CPU, served gzipped as GitHub Pages serves it, and fails over its ceilings for time to something useful, bytes to ready and JS heap (CI's browser tier). `src/size.test.ts` caps `dramatis/three` (7 KiB gzip) and `dramatis` (86 KiB; see Changed), and the creator's build fails if its script passes 2.6 MB gzip. `bun tools/perf/phone.ts` measures the same with slow 4G throttling as well.
- **The creator and the demo load 1.5 MB of clips, not 6.3 MB.** They fetched all of UAL1_core.glb (39 clips) to play five; `site/static/clips/ual-starter.glb` is the mannequin and the six clips they use, cut byte for byte by `bin/make-ual-starter.ts`. On an emulated phone's slow 4G that is about 24 s less before the character moves. The viewer's **more clips** still fetches the whole library (#3654).
- **Every way into the site is listed and capped** (#3669). `src/contracts/doors.ts` names the doors (`#c=`, `?handoff=`, `?glb=`, and **import character (.json)**), and a test fails on a page that reads its URL anywhere else, or on a door without hostile-input tests (oversize, malformed, prototype keys). New caps: a `?glb=` fetch stops at 128 MB (the viewer, the demo and the Unity player), a handoff id over 64 characters is refused before IndexedDB, and an imported character file over 16 MB is refused unread. The sample dev servers listen on localhost unless `--host` says otherwise.
- **The three.js viewer: the latest load wins.** Two overlapping loads (a drop during a `?glb=` fetch) let the slower one land, and its menus and status went to the other model. Each load now takes a ticket and stops once a newer one starts; an overtaken model is disposed (#3665).
- **The three.js viewer's licence panel:** a Dramatis block it can't validate (a later version, an unknown face unit) still lists its entries, flagged as invalid, instead of "names no licences"; and a `?glb=` file from another site is labelled with that site's origin and "the licences as that file states them", so a third party can't show its claims as this site's (#3664).

## [0.1.2] - 2026-11-02

The site's release: the library is unchanged from 0.1.1 (the same code; on npm only the version and README differ).

### Added

- **View in Unity** in the creator, beside View in three.js: the export opens in the Unity player (`/unity/`) by the same in-browser handoff. A browser test drives it through Unity's Web player to the character's four gaits.
- The Dramatis icon, favicon and header logo (Tonio Loewald's), and a home-screen icon on every page.
- The home page and the three.js demo link the Unity demo.

### Changed

- The site's colours: the icon's brown on pale parchment, light and dark, across the docs, the creator and the demos (the 3D stages keep their neutral grey). tosijs-3d's header link is its icon.

### Fixed

- CI's browser tests left their pages open, so pages kept drawing and starved the tests after them; the site's deploys since the icon went in had been skipped for it.

## [0.1.1] - 2026-11-02

Dramatis on tosijs-3d 0.12: what it used to copy from tosijs-3d is now imported from its engine-free subpaths. Nothing public changes, and exports are the same.

### Changed

- `tosijs-3d` pinned at 0.12.1 (0.1.0 shipped on 0.12.0). 0.12.1 adds `tosijs-3d/skinned-glb`, the skinned GLB writer moved upstream from Dramatis; Dramatis does not use it yet, so its own writer still makes the export.
- `dramatis` is 665 B gzip smaller (`dist/index.js` 33.4 KB gzip); `dramatis/three` unchanged.

### Removed

Dramatis's copies of tosijs-3d, now that 0.12.0 promises its character core as engine-free subpaths. Exports are unchanged (every sample in `samples/out/` rebuilds equivalent).

- `src/build/settings.ts`'s hand-copied defaults and slots: `DEFAULTS` and `SLOTS` are read from `tosijs-3d/character-settings` (`DEFAULT_CHARACTER`, `CHARACTER_SLOTS`), and `HM08_PACK_URL` is built from its `HM08_PACK_PATH` and `HM08_PACK_VERSION` (the same string). `eyeStyle` stays Dramatis's own. The licence manifest's slots and the extremes sweep's wrapping slots are tosijs-3d's too.
- `src/build/cover.ts`: the export covers the skin with `tosijs-3d/proxy-cover`'s `coverSkin`.
- `src/build/human-rig.js` and `human-rig.d.ts` (the Babylon-free type shim, and its test): `tosijs-3d/human-rig` is imported directly.
- The eyes' own copy of `eyeCentre`: tosijs-3d's (`tosijs-3d/rigged-body`) is used. The UV mapping stays Dramatis's (glTF's handedness, v down, both eyes on one picture).
- The creator's never-disposed `NullEngine`, kept so Babylon would not forget tosijs-3d's material plugins after navigating away: tosijs-3d 0.12 registers them again.

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
