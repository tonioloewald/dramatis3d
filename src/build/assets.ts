// The licence-manifest ids of what a build uses (licences.ts, `LicenceEntry`):
// `<source>:<kind>/<name>`, as the contract spells them.

import type { HumanPack } from 'tosijs-3d/human-pack'

export interface AssetIds {
  /** The base body: `makehuman:base/hm08`. */
  base: string
  /** A part on the base's own vertices: `makehuman:part/eyes`. */
  part(name: string): string
  /** A proxy (clothes, hair, brows, teeth): `makehuman:proxy/<name>`. */
  proxy(name: string): string
  /** The skin colour's scale: `monk:skin-tone/monk-skin-tone-scale`. */
  skinTone: string
}

export function assetIds(pack: Pick<HumanPack, 'manifest'>): AssetIds {
  return {
    base: `makehuman:base/${pack.manifest.base}`,
    part: (name) => `makehuman:part/${name}`,
    proxy: (name) => `makehuman:proxy/${name.toLowerCase()}`,
    skinTone: 'monk:skin-tone/monk-skin-tone-scale',
  }
}
