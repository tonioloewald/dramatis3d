// The licence manifest and lookup (lane share-licence). The contract is
// src/contracts/licences.ts; the page is site/docs/licences.md.

import { eyeAsset, eyeStyle } from '../upstream/eyes'
import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack } from 'tosijs-3d/human-pack'
import type { LicenceEntry } from '../contracts/licences'
import { UnlicensedAssetError } from './errors'
import {
  COMMUNITY,
  hairId,
  lookId,
  MANIFEST,
  proxyId,
  slug,
  type CommunityAsset,
} from './manifest'
import { PACKS } from './packs'
import { CHARACTER_SLOTS } from 'tosijs-3d/character-settings'

export { UnlicensedAssetError } from './errors'
export { COMMUNITY, MANIFEST, type CommunityAsset } from './manifest'

const BY_ID = new Map(MANIFEST.map((e) => [e.asset, e]))

/**
 * The manifest: every asset Dramatis can put in a character, with its source
 * and licence. An asset not in it is never shipped and never exported
 * (`buildCharacter` throws `UnlicensedAssetError` on one). Community assets
 * nobody has checked yet are not in it.
 */
export function licenceManifest(): readonly LicenceEntry[] {
  return MANIFEST
}

/**
 * One asset's manifest entry by id (`makehuman:base/hm08`), or undefined when
 * the manifest has no entry for it.
 */
export function lookupLicence(asset: string): LicenceEntry | undefined {
  return BY_ID.get(asset)
}

/** The community assets the packs carry, unchecked and so excluded. */
export function communityAssets(): readonly CommunityAsset[] {
  return COMMUNITY
}

/** The slots a character wears one garment in: tosijs-3d's CHARACTER_SLOTS. */
export const WEARABLE_SLOTS = CHARACTER_SLOTS

/** The settings that pick hair (tosijs-3d's character). */
const HAIR_SETTINGS = ['hair', 'beard', 'moustache', 'brows'] as const

/** The hosted bodies besides MakeHuman's, by their `source` setting (tosijs-3d's CHARACTER_SOURCES). */
const HOSTED_BODIES: Record<string, string> = {
  'Blender: female, realistic': 'blender:base/body-female-realistic',
  'Blender: male, realistic': 'blender:base/body-male-realistic',
  'Quaternius: superhero, male': 'quaternius:base/superhero_male',
  'Quaternius: superhero, female': 'quaternius:base/superhero_female',
}

const HAIR_PIECES = new Map(
  PACKS.quaternius.pieces.map((p) => [p as string, hairId(p)])
)

/** A user's own file: Dramatis makes no claim about it (SPDX NOASSERTION). */
function own(kind: 'garment' | 'base', name: string): LicenceEntry {
  return {
    asset: `user:${kind === 'base' ? 'body' : 'garment'}/${slug(name)}`,
    title: `${name} (the user's own ${kind === 'base' ? 'body' : 'garment'})`,
    kind,
    licence: 'NOASSERTION',
    licenceUrl: 'https://spdx.github.io/spdx-spec/v2.3/',
    source: "supplied by the character's author",
    author: "the character's author",
  }
}

/**
 * The licence entries for every asset a character uses with this pack, each
 * once, base first: the base mesh and its parts, the skin-tone data, UAL's
 * skeleton, each hair piece and worn garment (and a garment's colourway when
 * it has its own entry). A garment or body of the character's own is listed
 * as `NOASSERTION`. Throws `UnlicensedAssetError` naming the first asset the
 * manifest has no entry for.
 */
export function characterLicences(
  character: Character,
  pack: HumanPack
): LicenceEntry[] {
  const s = character.settings
  const proxies = pack.manifest.proxies ?? {}
  const ids: string[] = []
  const extra = new Map<string, LicenceEntry>()
  const str = (key: string): string | undefined =>
    typeof s[key] === 'string' ? (s[key] as string) : undefined

  // The base first.
  const source = str('source') ?? 'MakeHuman'
  const madeHuman = source === 'MakeHuman'
  if (madeHuman) {
    ids.push('makehuman:base/hm08', 'makehuman:expression/face-poseunits')
    for (const part of Object.keys(pack.manifest.parts ?? {}))
      ids.push(`makehuman:part/${slug(part)}`)
    // Worn always, bound to the mouth (tosijs-3d's character).
    for (const name of Object.keys(proxies))
      if (
        proxies[name]!.category === 'teeth' ||
        proxies[name]!.category === 'tongue'
      )
        ids.push(proxyId(name))
    ids.push('monk:skin-tone/monk-skin-tone-scale')
    // The eyes' texture (the eye art, recoloured): src/upstream/eyes.
    if (pack.manifest.parts?.eyes) ids.push(eyeAsset(eyeStyle(s.eyeStyle)))
  } else if (HOSTED_BODIES[source] != null) {
    ids.push(HOSTED_BODIES[source]!)
  } else {
    const e = own('base', source)
    extra.set(e.asset, e)
    ids.push(e.asset)
  }
  // Every export carries UAL's skeleton.
  ids.push('quaternius:skeleton/ual')

  for (const key of HAIR_SETTINGS) {
    const v = str(key)
    if (v == null || v === 'none') continue
    if (proxies[v] != null) ids.push(proxyId(v))
    else if (HAIR_PIECES.has(v)) ids.push(HAIR_PIECES.get(v)!)
    else throw new UnlicensedAssetError(`unknown:${key}/${v}`)
  }

  if (s.hideClothes !== true) {
    for (const slot of WEARABLE_SLOTS) {
      const v = str(slot)
      if (v == null || v === 'none') continue
      if (character.garments[v] != null) {
        const e = own('garment', v)
        extra.set(e.asset, e)
        ids.push(e.asset)
        continue
      }
      const proxy = proxies[v]
      if (proxy == null) throw new UnlicensedAssetError(`unknown:${slot}/${v}`)
      ids.push(proxyId(v))
      const look = character.cloth[slot]?.look
      if (look != null && look !== 'as made' && proxy.material?.looks?.[look])
        ids.push(lookId(v, look))
    }
  }

  const out: LicenceEntry[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const entry = BY_ID.get(id) ?? extra.get(id)
    if (entry == null) throw new UnlicensedAssetError(id)
    out.push(entry)
  }
  return out
}
