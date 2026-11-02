# Documentation

<!--{"pin": "top", "order": 1, "description": "The Dramatis docs: the creator, the library, the export format, one import guide per engine, and what has been verified where."}-->

Dramatis makes a character in the browser and exports it as a GLB (and a
VRM) that other engines open with no fixes. These pages cover the
[creator](/creator/), the library under it, the file it writes, and how to
import that file into each engine.

Dramatis is at 0.1.2 (0.1.0 was its first release) (`npm install dramatis`). Each page
says what has been checked and what has not.

## Start here

- [Creator](/creator/): make a character, then download it as a GLB, view
  it in three.js, or share it as a link.
- [three.js viewer](/viewer/): open any GLB, play UAL's clips on it, drive
  its face and read its licences.
- [three.js demo](/demo/): walk a character round a small scene: one saved
  in this browser, or a GLB or character file you open.
- [Unity player](/unity/): the same walk-round in Unity's Web player, the
  export loaded at runtime with glTFast.

## The file you export

- [Export](/export/): what happens to a character on the way out, the
  options, and the known gaps.
- [Export format](/export-format/): the profile every GLB and VRM follows
  (normative).
- [VRM](/vrm/): the VRM 1.0 export, its bone map, expressions, look-at and
  licence terms.

## Import guides

Each engine's own glTF importer, default settings, no plugins.

| Engine | Guide | Status |
| --- | --- | --- |
| three.js | [three.js](/guide-threejs/) | **Verified**: gate 1 under Bun, and in headless Chromium |
| Godot 4.5 | [Godot](/guide-godot/) | **Verified**: headless import and checks, and rendered frames |
| Babylon.js 9.33 | [Babylon.js](/guide-babylon/) | **Verified** on a `NullEngine` (no rendering) |
| Unity 6 | [Unity](/guide-unity/) | **Verified**: batch import and checks (28/28), Humanoid, and a Web player |
| Unreal Engine 5 | [Unreal Engine 5](/guide-unreal/) | **Draft, not verified**: a procedure no one has run yet |

Blender 5.2 also imports every sample cleanly; it is a second opinion, with
no guide of its own. The evidence for each row is in
[`reports/spike-1.md`](https://github.com/tonioloewald/dramatis3d/blob/main/reports/spike-1.md).
"Verified" means the checks ran on the four sample exports. Looks have not
been judged on a real GPU in any engine.

## The library

- [Dramatis core](/dramatis-core/): the engine-free API (`dramatis`): build,
  export, share links, licences, VRM.
- [dramatis/three](/dramatis-three/): the three.js embed: a built character
  as live three.js objects, and UAL clips on it.

## The project

- [Licences and share links](/licences/): every shipped asset, its source
  and its licence, and how a character becomes a link.
- [The extremes sweep](/extremes/): how garments and hair are checked on
  the most extreme bodies the sliders make.

## Not written yet

- A quick start (make a character and export it, in a few lines).
- A page on the character file format (`tosijs-character`), which tosijs-3d
  owns.

## Every page, in the order of the menu

This list is written by the build (`bun run build`): don't edit it by hand.

<!-- toc -->
- [Dramatis core](/dramatis-core/)
- [dramatis/three](/dramatis-three/)
- [Export](/export/)
- [VRM](/vrm/)
- [Export format](/export-format/)
- [three.js](/guide-threejs/)
- [Godot](/guide-godot/)
- [Babylon.js](/guide-babylon/)
- [Unity](/guide-unity/)
- [Unreal Engine 5 (draft)](/guide-unreal/)
- [Licences and share links](/licences/)
- [The extremes sweep](/extremes/)
<!-- /toc -->
