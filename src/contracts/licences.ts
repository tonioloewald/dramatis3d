// The asset licence manifest. Lane: share-licence (src/licences/).
// Page: site/docs/licences.md. In exports: site/docs/export-format.md.

import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack } from 'tosijs-3d/human-pack'
import { notImplemented } from './lanes'

/** What an asset is, as the licence page groups them. */
export type AssetKind =
  | 'base'
  | 'eyes'
  | 'eyelashes'
  | 'teeth'
  | 'tongue'
  | 'brows'
  | 'beard'
  | 'hair'
  | 'garment'
  | 'texture'
  | 'animation'
  | 'skin-tone'
  | 'other'

/**
 * One asset's source and licence: a row of the licence page and an entry in
 * an export's `asset.extras.dramatis.licences`.
 *
 * Asset ids are `<source>:<kind>/<name>`, lower case, stable across
 * releases: `makehuman:base/hm08`, `makehuman:proxy/toigo_harem_pants`,
 * `makehuman:part/eyes`, `quaternius:hair/<name>`, `quaternius:animation/ual1`,
 * `monk:skin-tone/monk-skin-tone-scale`.
 */
export interface LicenceEntry {
  /** The asset id (above). */
  asset: string
  /** What it is called, for people. */
  title: string
  kind: AssetKind
  /** An SPDX licence id: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`. */
  licence: string
  /** The licence's text, as a URL. */
  licenceUrl: string
  /** Where the asset came from (a repo at a commit, a page, a pack). */
  source: string
  /** Who made it, as they name themselves. */
  author: string
  /**
   * The credit line the licence asks for, word for word. Required when the
   * licence requires attribution (any CC BY); absent for CC0.
   */
  attribution?: string
  /** True when Dramatis changed it (refitted, baked, recoloured). */
  modified?: boolean
}

/**
 * The manifest: every asset Dramatis can put in a character, with its
 * licence. An asset not in it is never shipped and never exported
 * (`buildCharacter` throws on one).
 */
export function licenceManifest(): readonly LicenceEntry[] {
  return notImplemented('share-licence')
}

/** One asset's entry by id, or undefined when it is not in the manifest. */
export function lookupLicence(asset: string): LicenceEntry | undefined {
  void asset
  return notImplemented('share-licence')
}

/**
 * The entries for every asset a character uses with this pack (the base,
 * its parts, each worn proxy, hair, skin-tone data), each once, base first.
 * Throws `UnlicensedAssetError` naming the first asset with no entry.
 */
export function characterLicences(
  character: Character,
  pack: HumanPack
): LicenceEntry[] {
  void character
  void pack
  return notImplemented('share-licence')
}

/** Thrown when a character uses an asset the manifest has no entry for. */
export class UnlicensedAssetError extends Error {
  readonly asset: string
  constructor(asset: string) {
    super(`no licence entry for asset ${asset}: it cannot be shipped`)
    this.name = 'UnlicensedAssetError'
    this.asset = asset
  }
}
