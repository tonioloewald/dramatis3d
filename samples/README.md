# samples

Per-engine sample projects: the test harness for the export gate (PLAN.md,
"Export (gate 1)"). Each imports an exported character with no manual fixes
and plays an existing third-party animation on it.

| Folder | What | Status |
| --- | --- | --- |
| `out/` | The sample exports, written by `bun bin/export-sample.ts` | Checked by `bun run gate1` |
| `three-glb/` | three.js: load an export, walk, face, licences | Tested in headless Chromium |
| `three/` | three.js: `dramatis/three` with live sliders | Still draws the hand-made stand-in character |
| `godot/` | Godot 4.5 project | Run headless and rendered (spike 1) |
| `unity/` | Unity project: batch check and the Web player for /unity/ | Run: 28/28, Web player built |

Babylon is checked by `tools/engines/babylon.ts` and has no sample folder;
Unreal 5 has a written procedure only (`site/docs/guide-unreal.md`).

Samples use each engine's existing character controllers; Dramatis builds none.
