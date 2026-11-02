# Dramatis: technical plan

**An open 3D character creator for the web.** CC0 base data, GLB and VRM out, works in any
engine, self-hostable. The creator (a hosted page you open and start making with) is the
product; the library under it is how games embed the same thing at runtime.

This plan serves the owner's launch plan (kept outside the repo). Its one launch blocker:
**a character must leave the creator and work elsewhere.** Until then there is nothing to show.

## Where it starts

Dramatis is built on tosijs-3d's character system (0.11.4 to 0.12.0), which **stays in
tosijs-3d**. The biped controller already loads characters (`b3d-biped`, `_loadCharacter`), the
rig tool and spring chains share its rigging maths, and the builder page is tosijs-3d's demo of
it. Taking any of it out would either remove a working feature or make tosijs-3d depend on a
package that depends on it. What exists:

| Piece | tosijs-3d module | Engine-free? |
| --- | --- | --- |
| Human pack: MakeHuman hm08 as data (positions, triangles, joint cubes, 348 macro targets, regions, proxies, 59 baked face units) | `human-pack` (converter in static-assets `bin/makehuman-pack.ts`) | yes |
| Macro sliders → morphed body | `human-morph` | yes |
| UAL's 65-joint skeleton placed from joint cubes, bone-heat skinning | `human-rig`, `rig-fit`, `bone-heat` | yes |
| Retargeting UAL clips onto any body | `retarget` / `retarget-babylon` | core yes |
| Clothes, hair, brows, beards: `.mhclo` binding, the one runtime fitter | `proxy-fit` / `human-proxy` | core yes |
| Quaternius hair warped from its own reference head | `hair-fit` / `human-hair` | core yes |
| Skin tone (Monk scale), lips | `skin-tone` | yes |
| Face: eyes, gaze, blink, expressions, lip sync | `human-face`, `human-expression` | no |
| Skin, hair and cloth shading (Babylon PBR plugins) | `skin-shading`, `hair-shading`, `cloth-shading` | no |
| Character as versioned JSON (`tosijs-character` v1), named saves in IndexedDB | `character-file`, `character-store` | yes |
| A pure GLB writer (static garment meshes, no skin or morphs) | `garment-file` (`writeGarmentGlb`) | yes |
| Tailor (cut a garment from the body), rig tool | `tailor-tool`, `rig-tool` | no |
| The builder page; the biped's character | `character-builder`, `character`, `b3d-biped` | no |

The skeleton already uses **UE mannequin names** (`pelvis`, `spine_01`, `upperarm_l`), so
Unreal's IK Retargeter maps it without setup. The design record, `CHARACTER-DESIGN.md`, is on
tosijs-3d's unmerged `character-design` branch, not on main. It carries the decisions
(MakeHuman not MB-Lab for licensing; bases not one baby-to-adult slider; `.mhclo` as the one
fitter).

## Shape

**Dramatis consumes tosijs-3d; what it puts out is engine-free.** The creator runs on
tosijs-3d (Babylon). Its outputs are pure GLB and VRM files, and later embed libraries that
give other engines the same capabilities at runtime, three.js first.

```
tosijs-3d           character system, biped controller, rigging, GLB writer (unchanged owner)
  ↑
dramatis            the creator product: app, VRM, share link, licences, docs, samples
  ↑
tosijs-3d-ensemble  adds Dramatis; GLB export; later its own embeddable loader

tosijs-3d/<pure>    the engine-free core, imported by subpath with no DOM and no Babylon
  ↑
dramatis/three      three.js embed
```

Every arrow points one way. **Work goes where it is general:**

| tosijs-3d (filed there as issues, built and tested there) | Dramatis |
| --- | --- |
| Skinned GLB writer (any rigged body, not just Dramatis's) | The creator app: landing, export button, share link, licence page |
| Baking shader looks into standard PBR textures | VRM export (expression presets, meta) |
| The slider-extremes sweep over its fitters | Per-engine sample repos and import guides |
| Keeping the core engine-free (below) | The three.js embed |
| "Bake to crowd variant" for its crowds | The crowds-in-the-city demo |

- **Built here, moved before it ships** (owner, 2026-11-02). So Dramatis need not wait on
  tosijs-3d, the general pieces in the left column may be written here first, under
  `src/upstream/`, against tosijs-3d's public subpaths only. They are never exported from
  Dramatis's public API, each has a `dramatis3d` board task tagged `upstream:tosijs-3d`
  naming its destination module, and each moves into tosijs-3d (and is deleted here)
  before Gate 1 closes, so there is never a published second copy. Dramatis imports
  tosijs-3d at an exact pinned version and runs its own no-Babylon bundle check until
  Stage A pins the core there.
- **Character controllers:** in Babylon, tosijs-3d's biped is the controller and its sample.
  In other engines, samples use existing controllers. Dramatis builds none.
- **One character file.** Dramatis reads and writes `tosijs-character` through tosijs-3d's
  `character-file`; a format change is made there, versioned, with a migration. No fork.
- **Assets stay on the CDN** (static-assets builds the packs), read through `human-pack`.

## The engine-free core

The three.js embed needs the body maths without Babylon. It is already engine-free in fact, and
tosijs-3d already has the mechanism to promise it: **pure subpaths** (`"./*"` exports), pinned
by `src/no-dom.test.ts` and checked on the published tarball by `bin/smoke-consumer.ts`.

**The closure** (computed from the import graph): 17 modules, about 9,400 lines and 186
exports, 15 with their own tests. `human-pack`, `human-morph`, `human-rig`, `rig-fit`,
`rig-recipe`, `retarget`, `bone-heat`, `spatial-transform`, `proxy-fit`, `proxy-rigid`,
`hair-fit`, `garment-cut`, `garment-file`, `uv-unwrap`, `skin-tone`, `character-file`,
`rigged-body`. 22 tosijs-3d modules import from it, among them the biped, the rig tool, spring
chains and the HUD, so it is engine maths as much as character maths.

**One leak:** `rigged-body.ts` and `human-rig.ts` have `import type { Material } from
'@babylonjs/core'`. It is erased at runtime but lands in the `.d.ts`, so a three.js consumer's
type-check needs Babylon installed.

**Stage A: promise it (tosijs-3d, additive, a minor).** Nothing moves, nothing is renamed,
nothing leaves the barrel.

1. Replace the `Material` type with a structural or generic one.
2. Add the 17 to `PURE` in `no-dom.test.ts` and `smoke-consumer.ts`.
3. Add a no-Babylon check: bundle each pure subpath for the browser and fail if `@babylonjs`
   appears in the output or its `.d.ts`. No-DOM alone doesn't catch Babylon.
4. Snapshot the barrel's export names before the change and assert them equal after.
5. Document the pure core on one docs page, as the embed surface.

**Stage B: a separate package (only on evidence).** Babylon is a peer of tosijs-3d, and npm
and bun install peers by default, so a three.js adopter of `tosijs-3d` downloads Babylon even
though the bundle never includes it. Spike 4 measures whether that matters. If it does,
**tosijs-3d** publishes the core as its own zero-dependency package from its own repo, and its
modules become re-exports at the same paths: one copy of every function, the same barrel names
and subpaths, guarded by the stage-A snapshot. Making the Babylon peers optional instead would
break Babylon consumers who rely on peer auto-install, so it is not the route.

**What must never break in tosijs-3d** (each is a test there):

- The barrel's export names (snapshot).
- The builder page and the biped's character (`doc-examples.test.ts`, the character tests).
- Reading every `tosijs-character` file it could read before.
- The pure subpaths under plain Node, on the tarball (`smoke-consumer.ts`).

## Export (gate 1)

An exported character imports into three.js, Babylon, Unity, Godot and Unreal 5 with no manual
fixes and plays an existing third-party animation. **The initial targets are three.js, Unity
and Godot** (owner, 2026-11-02; Godot because it is free and open source); Babylon is checked
where cheap and Unreal 5 is secondary. The first public release needs the site to export a
character that works in three.js; the rest of gate 1 follows. In each engine:

- **Skeleton maps automatically.** UE mannequin naming is the default (it is what UAL is).
  A Mixamo-named export is an option; spike 1 decides whether Unity Humanoid needs it.
- **Morphs and materials survive** and the character looks right under default lighting.
- **Scale, axes and root are right.** Metres, Y-up, right-handed, as glTF wants; root at the
  feet.
- **Clothing deforms with the body** during that animation.

What the writer adds to `writeGarmentGlb`:

- **Skin:** `JOINTS_0` / `WEIGHTS_0` (max 4 influences, renormalised), inverse bind matrices,
  one skeleton shared by body and every garment.
- **The shape is baked;** the 59 face units go out as **morph targets** (body, lashes, teeth,
  tongue and whatever is bound to the face), so lip sync and expressions work downstream.
- **Covered skin is removed** from the exported body (`coverBody`), not hidden.
- **Materials are standard glTF PBR.** The Babylon shading plugins (skin scatter, hair
  highlights) don't travel. Bake what they compute into textures (skin albedo with lips and
  stubble, eye textures drawn in code, recoloured cloth) and use `KHR_materials_sheen` for
  fabrics. Losing scatter is the honest cost; the creator keeps it.
- **Rest pose:** VRM needs a T-pose and Unity Humanoid prefers one. UAL's rest pose decides
  whether export re-poses the bind.
- **Licences travel in the file:** every asset's source and licence in the glTF `asset` extras,
  and in VRM's meta.
- **Validated:** the Khronos glTF validator is clean on every export in CI.

**VRM (should):** VRM 1.0 is glTF plus `VRMC_vrm`: a humanoid bone map (we have it), expression
presets (aa, ih, ou, ee, oh, blink, happy, …) mapped from the face units, look-at from the eye
joints, and meta with the CC0 licence.

## Must-haves beside export

- **Starter wardrobe:** about 12 fitted CC0 garments from MakeHuman's packs, chosen for range,
  each checked at the slider extremes. No clothing builder needed.
- **No broken fits at the extremes.** A test sweeps slider corners and reports penetration
  (garment and hair vertices inside the body), bone-length sanity, and a contact sheet to look
  at. Avatars are judged on their worst screenshot.
- **Load time and phones.** Measure first useful paint and memory on a mid-range phone; targets
  are fetched lazily already. Set a budget and keep it in CI.
- **Share link:** the character file deflated (fflate is already a dependency) into the URL
  fragment. A fragment never reaches a server.
- **Asset licence manifest:** every shipped asset with source and licence, stated on the page
  and carried into exports. Known: MakeHuman core assets CC0, Quaternius hair and UAL CC0,
  Monk Skin Tone Scale CC BY 4.0 (credited). MakeHuman community assets carry their own
  licences; nothing ships unchecked.

## Spikes (each answers one question with evidence)

1. **Round trip in five engines.** Hand-build one exported character (one garment, one face
   unit) and import it into all five. Record what breaks per engine. Automate what can be:
   three.js and Babylon in a browser, Godot with `--headless --import`, Blender as a second
   opinion. Unity and Unreal run on the owner's machine (batch mode where possible).
2. **Baked materials.** How close a baked skin gets to the creator's under each engine's
   default lighting.
3. **VRM.** One character into a VRM viewer and a VTuber app; which face units map to which
   presets.
4. **three.js embed.** The pure core's rig and morph driving a three.js `SkinnedMesh`, with
   the ecctrl controller: the start of the first sample repo. It also measures what installing
   `tosijs-3d` costs a three.js adopter, which decides stage B.

## Sequence

1. **Stage A in tosijs-3d** (the pure core promised and pinned), and the creator app
   skeleton here, on tosijs-3d.
2. **Export to gate 1.** The skinned writer in tosijs-3d, then spike 1 until all five engines
   pass. The sample
   repos (three.js first, then Unity) are the gate's test harness, not extra work.
3. **Launch readiness.** Wardrobe, extremes sweep, phone budget, share link, licence page,
   docs (quick start, format spec, per-engine import guides, `llms.txt`).
4. **VRM, Mixamo naming, three.js runtime embedding.**
5. **Crowds** (second launch): a "bake to crowd variant" step whose far version matches the
   near one in morphs and clothing, for the city demo (on tosijs-3d's city) to swap between.

## Out of scope

- Character controllers and gameplay. tosijs-3d's biped serves Babylon; other engines' samples
  use existing controllers.
- Stylised and anime bases at launch: bases are pluggable; contribute one.
- Child and non-human bases, the clothing builder (Wardrobe), tattoos and face images, and
  reference-sheet-to-mesh: each is its own later launch.
- Accounts, hosting of user characters. The creator stores in the browser and shares by URL.

## Decisions for the owner

- **Stage B.** Recommended: decide after spike 4 measures the install cost; until then the
  pure subpaths are the embed surface.

- **Default skeleton naming.** Recommended: keep UE mannequin (what UAL is) as the default,
  Mixamo as an option, pending spike 1.
- **Names.** `dramatis` and `dramatis3d` are free on npm, and the `dramatis3d` GitHub org is
  free. Claiming them is the owner's.
