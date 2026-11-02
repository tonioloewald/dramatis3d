// A stand-in for a dependency whose declarations import Babylon: what
// tosijs-3d's rigged-body.d.ts did up to 0.11.6 (`import type { Material }`),
// fixed in 0.12.0 by typing the material as a name. Kept as a fixture so the
// guard's type-closure check still has a leak to catch.
import type { Material } from '@babylonjs/core'
export interface LeakyBody {
  surfaces: { material: Material }[]
}
