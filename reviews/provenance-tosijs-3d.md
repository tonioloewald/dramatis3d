# Provenance check: tosijs-3d's MakeHuman-like code against MakeHuman's

2026-11-04, for #3776. It follows [provenance-makehuman.md](provenance-makehuman.md)
(#3688), which covered Dramatis's own code and left out tosijs-3d, where nearly all of
the export path's MakeHuman-like logic lives. The rule (CLAUDE.md): MakeHuman's data
is CC0 and used as published; its code is AGPL and is not copied.

**What was compared:**

- **MakeHuman 1.x** at `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`, the Python under
  `makehuman/makehuman/`.
- **tosijs-3d v0.12.2** (the version Dramatis pins, `a59d79ee2`), `src/`.
- **static-assets** `bin/makehuman-pack.ts` at `270293f`, the converter that builds the
  hm08 pack.

**How:** a reviewer that did not write the code read the files side by side and
grepped both ways for MakeHuman's identifiers and constants: `ref_vIdxs`,
`vertWeights`, `deleteVerts`, `z_depth`, `scaleData`, `WEIGHT_THRESHOLD`, 5.333,
0.1875 and the skin-blender colours. It judged structure rather than tokens, since a
Python-to-TypeScript translation defeats a clone tool.

**Result: nothing copied or transliterated.** Each overlap is one of two kinds:
something the file formats require, or reproduced behaviour (one age breakpoint) in
code written differently.

| File | MakeHuman counterpart | Verdict |
| --- | --- | --- |
| proxy-fit.ts | shared/proxy.py | Format only. The fit is the `.mhclo` row formula. Weight transfer, the nearest-weight grid, covering and smoothing are different algorithms, or MakeHuman has no equivalent. |
| proxy-cover.ts | proxy.py `deleteVerts`, human.py masking | Independent. It tucks skin along normals with a Dijkstra fade, which MakeHuman doesn't do. |
| proxy-rigid.ts | none | Independent. |
| human-morph.ts | apps/human.py, apps/humanmodifier.py | Format only. Corner weights follow the target file names. The 0.1875 age node is shared (see below). The ancestry maths and `ageYears` differ. |
| human-rig.ts | shared/skeleton.py, default.mhskel | Format only. A joint is the centroid of its cube's vertices, which is what `.mhskel` means. The rest is its own. |
| human-pack.ts | none | Independent. It reads tosijs-3d's own binary pack. |
| human-proxy.ts | shared/material.py | Independent. |
| skin-tone.ts | apps/autoskinblender.py | Independent. It uses the Monk scale in linear light, and none of MakeHuman's colours. |
| garment-bind.ts | proxy.py; MakeClothes (not compared) | Independent. It uses the closest point on a triangle (Ericson, cited). Only its output is the `.mhclo` row shape. |
| garment-cut.ts, garment-file.ts | none | Independent. |
| rig-fit.ts, rig-markers.ts, rig-build.ts, rig-recipe.ts | none | Independent. MakeHuman has no marker auto-rigger. |
| human-expression.ts, human-face.ts | posing/expression plugins | Independent. The unit names are the CC0 `face-poseunits.json`. |
| static-assets makehuman-pack.ts | proxy.py loaders, bvh.py, animation.py, material.py | Format only. It reads the formats by their keywords. The parser structure, single-vertex rows, `delete_verts` ranges, BVH tokenising and skinning all differ. |

**Closest overlaps:**

1. **The age breakpoint 0.1875**
   - Where: tosijs-3d human-morph.ts:95-124, and MakeHuman apps/human.py:552-598.
   - It appears in MakeHuman's code and in no data file. The baby/child/young/old
     weights give the same numbers as MakeHuman's.
   - The code is different. MakeHuman clamps with 5.333 and 3.2; tosijs-3d divides by
     0.1875 and 0.3125, and neither 5.333 nor 3.2 appears.
   - The age in years also differs (11 years at 0.1875 against MakeHuman's 10).
   - This reproduces a parameter so the sliders mean the same body as MakeHuman's. It
     is behaviour, not code. The module header would be clearer if it said where
     0.1875 comes from; that's filed as a suggestion on tosijs-3d (#3845).
2. **The min/average/max and two-sided factors, and corner weight as a product:**
   both follow from the target file names. tosijs-3d builds the names in loops, while
   MakeHuman resolves them through its modifier JSON.
3. **The proxy fit's per-axis scale:** this is the equation `x_scale v1 v2 den` means.
   MakeHuman builds a 3x3 matrix with shear; tosijs-3d uses per-axis scalars with no
   shear.
4. **Proxy skin weights:**
   - The idea is the same: the base mesh's weights pass through the binding.
   - The structure differs. MakeHuman loops over bones, uses a threshold of 1e-4 and
     doesn't normalise. tosijs-3d loops over rows, keeps the top four weights and
     normalises.
5. **Parsing `.mhclo`:**
   - The keywords are the format's.
   - The structure differs: section regexes against an `if key ==` chain, and
     single-vertex rows as `[r0, r0, r0]` against `(v0, 0, 1)`.

**Not checked:**

- **Read only in part** (headers and function lists, because MakeHuman has no
  counterpart algorithm): rig-fit.ts, garment-cut.ts, garment-file.ts, rig-markers.ts,
  rig-recipe.ts, rig-build.ts, human-expression.ts and human-face.ts.
- **MakeClothes**, the Blender add-on that writes `.mhclo` bindings. It's the likeliest
  counterpart for garment-bind, and it isn't in this checkout.
- **Other MakeHuman code:** MPFB2, MakeHuman 2.x and the 1.x export plugins.
- **Other tosijs-3d files:** retarget.ts, bone-heat.ts (Baran and Popović; MakeHuman
  has no counterpart), mesh-sdf.ts and the extremes files.
- **Git history** of either repository, so a copy that was later rewritten would not
  show.

With [provenance-makehuman.md](provenance-makehuman.md), this covers Dramatis's export
path at the pinned versions: Dramatis's code, tosijs-3d 0.12.2, and the pack converter.
