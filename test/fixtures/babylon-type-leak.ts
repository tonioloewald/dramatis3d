// Deliberate failure case for src/no-babylon.test.ts: a type-only Babylon import.
// Erased from the bundle, so only the declaration checks can catch it (this is
// the shape of the leak PLAN.md records in tosijs-3d's rigged-body and human-rig).
import type { Material } from '@babylonjs/core'
export type Look = { material: Material }
export const look = (): Look | null => null
