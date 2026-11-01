// The Babylon-free declarations of what src/build uses from tosijs-3d's
// human-rig (see human-rig.js). The shapes are tosijs-3d's own, less
// `RiggedBody`'s Babylon-typed fields (`surfaces[].material`, which a
// MakeHuman body never has). human-rig.test.ts checks them against the real
// declarations.

import type { SkinWeights } from 'tosijs-3d/bone-heat'
import type { HumanPack, HumanPackManifest } from 'tosijs-3d/human-pack'
import type { MacroBody } from 'tosijs-3d/human-morph'
import type { FittedRig } from 'tosijs-3d/rig-fit'

export interface HumanRigRow {
  name: string
  parent: string | null
  at: string
  end?: string
  lean?: number
}

export declare const HM08_UAL: readonly HumanRigRow[]

export declare function humanRig(
  manifest: HumanPackManifest,
  positions: ArrayLike<number>,
  table?: readonly HumanRigRow[],
  options?: { triangles?: ArrayLike<number> }
): FittedRig

export interface HumanSkin {
  vertices: Uint32Array
  triangles: Uint32Array
  positions(full: ArrayLike<number>, into?: Float32Array): Float32Array
}

export declare function humanSkin(pack: HumanPack): HumanSkin

/** tosijs-3d's HumanRiggedBody, as far as a MakeHuman body fills it. */
export interface HumanBody {
  positions: Float32Array
  indices: Uint32Array
  rig: FittedRig
  weights: SkinWeights
  regions: Record<string, Float32Array>
  full: Float32Array
  skin: HumanSkin
}

export interface HumanBodyMaker {
  skin: HumanSkin
  weights: SkinWeights
  first: HumanBody
  body(values?: Partial<MacroBody>): Promise<HumanBody>
}

export declare function humanBodyMaker(
  pack: HumanPack,
  values?: Partial<MacroBody>
): Promise<HumanBodyMaker>
