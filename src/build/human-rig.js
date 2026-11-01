// tosijs-3d's human-rig, re-exported unchanged at runtime. Its types come
// from human-rig.d.ts beside this file, not from tosijs-3d's own
// declarations: those import `RiggedBody` from `rigged-body.d.ts`, which
// imports Babylon's `Material` (the leak PLAN.md records, fixed by tosijs-3d's
// stage A). TypeScript reads the .d.ts and never this file; Bun and every
// bundler read this file. Delete both once stage A ships and import
// `tosijs-3d/human-rig` directly. `human-rig.test.ts` pins the two type sets
// together, so this cannot drift from the real module unnoticed.
export {
  HM08_UAL,
  humanBodyMaker,
  humanRig,
  humanSkin,
} from 'tosijs-3d/human-rig'
