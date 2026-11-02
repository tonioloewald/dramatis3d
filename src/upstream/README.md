# src/upstream: built here, moved before it ships

PLAN.md assigns some general pieces to **tosijs-3d** (the skinned GLB writer,
baking shader looks into PBR textures, the slider-extremes sweep, keeping the
core engine-free). So that Dramatis need not wait on tosijs-3d, they may be
written here first. The rules (owner, 2026-11-02):

1. **Public subpaths only.** Code here imports tosijs-3d by its published
   subpaths (`tosijs-3d/human-morph`, ...), never by a relative path into a
   tosijs-3d checkout, so it moves without edits to its imports.
2. **Never exported.** Nothing in `src/index.ts` or `src/three/index.ts` (or any
   future public entry) re-exports from `src/upstream/`. It is not part of
   Dramatis's API and nobody outside this repo may come to depend on it.
3. **One board task per piece.** Each module here has a `dramatis3d` virta task
   tagged `upstream:tosijs-3d` that names its destination module in tosijs-3d.
4. **Moved before it ships.** Each piece moves into tosijs-3d (built and tested
   there) and is deleted here **before Gate 1 closes**, so there is never a
   published second copy.

What is here now:

| Module | Destination in tosijs-3d | Board task |
| --- | --- | --- |
| `glb/` | `skinned-glb` (the skinned GLB writer) | #3662 |
| `extremes/` | `fit-extremes` (the slider-extremes sweep) | #3661 |

Until then Dramatis pins tosijs-3d at an exact version and runs its own
no-Babylon bundle check (`src/no-babylon.test.ts`).
