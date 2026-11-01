# Dramatis: technical plan

**An open 3D character creator for the web.** CC0 base data, GLB and VRM out, works in any
engine, self-hostable. The creator (a hosted page you open and start making with) is the
product; the library under it is how games embed the same thing at runtime.

This plan serves the owner's launch plan (kept outside the repo). Its one launch blocker:
**a character must leave the creator and work elsewhere.** Until then there is nothing to show.

## Where it starts

Dramatis is tosijs-3d's character builder (0.11.4 to 0.11.6), broken out. What exists:

| Piece | tosijs-3d module | Engine-free? |
| --- | --- | --- |
| Human pack: MakeHuman hm08 as data (positions, triangles, joint cubes, 348 macro targets, regions, proxies, 59 baked face units) | `human-pack` (converter in static-assets `bin/makehuman-pack.ts`) | yes |
| Macro sliders → morphed body | `human-morph` | yes |
| UAL's 65-joint skeleton placed from joint cubes, bone-heat skinning | `human-rig`, `rig-fit` | yes |
| Retargeting UAL clips onto any body | `retarget` / `retarget-babylon` | core yes |
| Clothes, hair, brows, beards: `.mhclo` binding, the one runtime fitter | `proxy-fit` / `human-proxy` | core yes |
| Quaternius hair warped from its own reference head | `hair-fit` / `human-hair` | core yes |
| Skin tone (Monk scale), lips | `skin-tone` | yes |
| Face: eyes, gaze, blink, expressions, lip sync | `human-face`, `human-expression` | no |
| Skin, hair and cloth shading (Babylon PBR plugins) | `skin-shading`, `hair-shading`, `cloth-shading` | no |
| Character as versioned JSON (`tosijs-character` v1), named saves in IndexedDB | `character-file`, `character-store` | yes |
| A pure GLB writer (static garment meshes, no skin or morphs) | `garment-file` (`writeGarmentGlb`) | yes |
| Tailor (cut a garment from the body), rig tool | `tailor-tool`, `rig-tool` | no |
| The builder page | `character-builder`, `character` | no |

The skeleton already uses **UE mannequin names** (`pelvis`, `spine_01`, `upperarm_l`), so
Unreal's IK Retargeter maps it without setup. The design record, `CHARACTER-DESIGN.md`, is on
tosijs-3d's unmerged `character-design` branch, not on main. It carries the decisions
(MakeHuman not MB-Lab for licensing; bases not one baby-to-adult slider; `.mhclo` as the one
fitter) and moves here.

## Shape

**The core is engine-agnostic; engines are adapters.** The pure modules above are most of the
value and already have no Babylon in them. Export is written against the core, not through an
engine's serializer, so the same exporter runs in the page, in a worker, headless in tests,
and under any adapter.

```
dramatis            core: packs, morph, rig, fit, retarget data, character file, GLB/VRM writer
dramatis/three      three.js adapter (the first outside embed target)
tosijs-3d           the Babylon adapter: rendering, shading, face runtime; depends on dramatis
apps/creator        the hosted creator (tosijs + tosijs-ui, viewing through tosijs-3d)
```

- **tosijs-3d depends on dramatis, never the reverse.** Its Babylon modules import the core
  from here; it re-exports the moved names until its next major.
- **Assets stay on the CDN** (static-assets builds the packs). Dramatis owns the pack *format*
  and its reader; the converter can move later.
- **The character file is the save format and the share format.** It is already versioned and
  read against defaults. It is renamed with care: a `tosijs-character` v1 file must still load.

## Export (gate 1)

An exported character imports into three.js, Babylon, Unity, Godot and Unreal 5 with no manual
fixes and plays an existing third-party animation. In each engine:

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
4. **three.js adapter.** The core's rig and morph driving a three.js `SkinnedMesh`, with the
   ecctrl controller: the start of the first sample repo.

## Sequence

1. **Repo and boundary.** Move the pure modules here with history, publish `dramatis` 0.x;
   tosijs-3d depends on it and re-exports. No behaviour change.
2. **Export to gate 1.** The writer, then spike 1 until all five engines pass. The sample
   repos (three.js first, then Unity) are the gate's test harness, not extra work.
3. **Launch readiness.** Wardrobe, extremes sweep, phone budget, share link, licence page,
   docs (quick start, format spec, per-engine import guides, `llms.txt`).
4. **VRM, Mixamo naming, three.js runtime embedding.**
5. **Crowds** (second launch): a "bake to crowd variant" step whose far version matches the
   near one in morphs and clothing, for tosijs-3d's city demo to swap between.

## Out of scope

- Character controllers and gameplay in any engine. Samples use existing controllers.
- Stylised and anime bases at launch: bases are pluggable; contribute one.
- Child and non-human bases, the clothing builder (Wardrobe), tattoos and face images, and
  reference-sheet-to-mesh: each is its own later launch.
- Accounts, hosting of user characters. The creator stores in the browser and shares by URL.

## Decisions for the owner

- **The boundary.** Recommended: core here, Babylon rendering stays in tosijs-3d (above).
  The alternative moves the Babylon modules here as `dramatis/babylon`, which makes tosijs-3d
  a consumer like any other but leaves its builder page depending on a sibling for its own
  scene.
- **Default skeleton naming.** Recommended: keep UE mannequin (what UAL is) as the default,
  Mixamo as an option, pending spike 1.
- **Names.** `dramatis` and `dramatis3d` are free on npm, and the `dramatis3d` GitHub org is
  free. Claiming them is the owner's.
