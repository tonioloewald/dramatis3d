# Lanes

How the build is split between agents working at once. Each lane owns a
territory and writes only there; everything else is either another lane's or
shared (below). Read PLAN.md and CLAUDE.md first, then your lane.

## The contracts

`src/contracts/` holds the types and signatures every lane builds against,
fixed before any lane starts. Each function a lane implements is there as a
stub that throws `not implemented: <lane>`, so everything compiles from the
start and a call that reaches a stub fails loudly.

| Contract | File | Implemented by |
| --- | --- | --- |
| The built character (the core/adapter boundary) and `buildCharacter` | `built-character.ts` | skinned-glb, in `src/build/` |
| `writeCharacterGlb`, `exportCharacterGlb` | `export.ts` | skinned-glb, in `src/build/` over `src/upstream/glb/` |
| `exportCharacterVrm` | `export.ts` | vrm, in `src/vrm/` |
| `encodeShareLink`, `decodeShareLink` | `share.ts` | share-licence, in `src/share/` |
| `licenceManifest`, `lookupLicence`, `characterLicences` | `licences.ts` | share-licence, in `src/licences/` |
| `characterObject` (three.js adapter) | `three-adapter.ts` | three, in `src/three/` |
| Creator-to-viewer handoff (`putHandoff`, `takeHandoff`) | `handoff.ts` | site-creator; three-viewer reads it |
| The GLB profile's names and the extras schema | `profile.ts` | implemented (it is the spec) |

**To implement a stub:** write the real function in your territory and make
the contract file re-export it in place of the stub (`export { buildCharacter }
from '../build'`), keeping the signature and its TSDoc. That one-line swap in
`src/contracts/` is the only edit a lane makes there. **To change a
signature or a type**, stop: say what and why in your report under
`contractChanges`, and change it only if no other lane is affected or the
change is additive. `src/contracts/contracts.test.ts` pins the profile's data
to tosijs-3d and each stub's lane name.

The normative export profile is `site/docs/export-format.md`. The gate-1
harness is `test/gate1/` (`bun run gate1`): it checks every GLB in
`samples/out/` and reports NOT RUN while that is empty.

## Launch lanes

| Lane | Territory | Docs page |
| --- | --- | --- |
| **skinned-glb** | `src/upstream/glb/` (the general skinned GLB writer, bound for tosijs-3d), `src/build/` (`buildCharacter`, `writeCharacterGlb`, `exportCharacterGlb`), `bin/export-sample.ts`, `samples/out/` | `site/docs/export.md` |
| **three** | `src/three/` (the adapter, `characterObject`), `samples/three/` | `site/docs/dramatis-three.md` |
| **share-licence** | `src/share/`, `src/licences/` | `site/docs/licences.md` |
| **site-creator** | `site/creator/` and the creator page and its parts; implements `src/contracts/handoff.ts` | `site/docs/creator.md` |
| **extremes** | `src/upstream/extremes/` (the slider-extremes sweep, bound for tosijs-3d), `bin/extremes.ts`, `reports/extremes*` | `site/docs/extremes.md` |

## Engines-phase lanes (later)

| Lane | Territory | Docs page |
| --- | --- | --- |
| **three-viewer** | `site/viewer/`, `samples/three-glb/` | `site/docs/guide-threejs.md` |
| **engines** | `tools/engines/`, `samples/godot/`, `samples/unity/`, `reports/spike-1.md` | `site/docs/guide-godot.md`, `guide-unity.md`, `guide-babylon.md`, `guide-unreal.md` |
| **vrm** | `src/vrm/` | `site/docs/vrm.md` |

## Swarm rules

1. **Stay in your territory.** A file outside it is another lane's or
   shared. Need something from another lane? Use its contract; if the
   contract lacks it, report it rather than reaching in.
2. **Shared files** are edited by any lane, minimally, and merged with
   care (rebase, never overwrite another lane's lines):
   - `package.json` and `bun.lock` (add a dependency or a script; never
     bump or remove another lane's),
   - `src/index.ts` and `src/three/index.ts` (add your exports),
   - `src/contracts/*` (only the stub-to-real swap above),
   - `site/docs/docs.md` (a link to your page), `site/config.ts`,
     `site/hydrate.ts`,
   - `.gitignore`, `README.md`, `.github/workflows/*`.
   `PLAN.md`, `CLAUDE.md`, `LANES.md`, `site/docs/export-format.md`,
   `src/no-babylon.test.ts` and `test/gate1/` are changed only with a
   reason in your report: they are what every lane is checked against.
3. **`src/upstream/` is never exported** from `src/index.ts`,
   `src/three/index.ts` or any public entry. Each module there gets a
   `dramatis3d` virta task tagged `upstream:tosijs-3d` naming its
   destination module, and moves into tosijs-3d before Gate 1 closes.
4. **No Babylon in the public entries**, at runtime or in types.
   `src/no-babylon.test.ts` is the check. Import tosijs-3d only by its
   public subpaths, and only pure ones from code the entries reach.
5. **Licences.** No asset ships without a licence entry. MakeHuman: CC0
   data only, logic reimplemented from the file formats, no MakeHuman code.
6. **Done means checked.** `bun run check` passes on your branch. A check
   that did not run is reported as not run, never as passed.
7. **Do not touch** `../tosijs-3d`, `../static-assets` or
   `../tosijs-3d-ensemble`, and file nothing in tosijs-3d's virta project.
   Read them freely; prefer `node_modules/tosijs-3d` (the pinned version).
