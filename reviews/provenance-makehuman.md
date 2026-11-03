# Provenance check: Dramatis's code against MakeHuman's

2026-11-03, for #3688 (pre-minor completeness gap 7). The rule (CLAUDE.md): MakeHuman's
data is CC0 and used as published; its code is AGPL and is not copied, Dramatis
reimplements what it needs from the file formats.

**Compared against:** https://github.com/makehumancommunity/makehuman at
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482` (2024-06-26), the Python under
`makehuman/makehuman/`. Read side by side by a reviewer that did not write the code, with
targeted greps for shared names and constants (no token-level clone tool: a Python to
TypeScript translation defeats one anyway). Dramatis at 25ee543.

**Result: nothing copied or transliterated.** Most of the MakeHuman-equivalent work is not
in Dramatis at all: it is imported from tosijs-3d.

| Dramatis | MakeHuman counterpart | Verdict |
| --- | --- | --- |
| `src/build/build.ts` | core/algos3d.py, shared/proxy.py, shared/animation.py, shared/material.py | Overlap dictated by the format only. Fitting, weights, covering, morphing, rig and skin tone come from tosijs-3d. The local face deltas, skin packing (4 weights, unweighted to the pelvis; MakeHuman uses root) and glTF materials are structured and named differently. |
| `src/build/math.ts` | lib/matrix.py, core/transformations.py | Independent: glTF xyzw quaternions; MakeHuman uses numpy 4x4. |
| `src/build/pose.ts` | shared/skeleton.py, shared/animation.py | Independent: re-poses to UAL's T-pose; nothing like it in MakeHuman. |
| `src/build/settings.ts`, `write.ts`, `assets.ts`, `options.ts` | apps/humanmodifier.py (settings only) | Independent. |
| `src/build/ual-rest.ts`, `make-ual-rest.ts` | none | Independent: Quaternius UAL data. |
| `src/licences/scan-packs.ts` | shared/proxy.py loaders, plugins/8_asset_downloader | Overlap dictated by the format only: reads pack JSON fields and directory names; parses no .mhclo or .mhmat. |
| `src/vrm/*`, `src/three/*`, `src/share/*` | none | Independent. |

The two closest overlaps are conventions: three weighted reference vertices plus an offset
(the .mhclo format's meaning; the fitting code is tosijs-3d's), and where unweighted
vertices go.

**Not checked:**

- **tosijs-3d** (`proxy-fit`, `proxy-cover`, `human-morph`, `human-rig`, `human-pack`,
  `skin-tone`): where nearly all the MakeHuman-equivalent logic lives (.mhclo fitting,
  macro targets, joint-cube rigging, weights, parsing the pack). It needs the same check
  before a provenance claim covers the export path: #3776.
- The static-assets converter that builds hm08.json (a sibling repo).
- `src/build/preview.ts`, `cdn.ts`, `index.ts`, `version.ts` (no MakeHuman concepts).
- Other MakeHuman codebases (MPFB2, MakeHuman 2): 1.x is the canonical one.
