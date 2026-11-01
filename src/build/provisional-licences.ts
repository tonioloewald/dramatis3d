// PROVISIONAL. The licence entries the sample exports carry until the
// share-licence lane's manifest (src/licences/, behind `characterLicences`)
// is wired in at integration; then bin/export-sample.ts switches to it and
// this file is deleted. It is not reachable from any public entry.
//
// It covers MakeHuman's own system assets only (the hm08 base, its eyes and
// lashes, and the core clothes, hair, brows, teeth and tongue the pack
// carries), which MakeHuman releases under CC0 1.0, and the Monk Skin Tone
// Scale (CC BY 4.0) that the skin colour comes from. Community assets are
// left out on purpose: each is checked one by one by the share-licence lane,
// so a character wearing one throws UnlicensedAssetError here.

import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack } from 'tosijs-3d/human-pack'
import {
  type AssetKind,
  type LicenceEntry,
  UnlicensedAssetError,
} from '../contracts/licences'
import { assetsUsed } from './build'

const CC0 = {
  licence: 'CC0-1.0',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
}

/** MakeHuman's system assets the hm08 pack carries (not community ones). */
export const MAKEHUMAN_SYSTEM_PROXIES: readonly string[] = [
  'female_casualsuit01',
  'female_casualsuit02',
  'female_elegantsuit01',
  'female_sportsuit01',
  'male_casualsuit01',
  'male_casualsuit02',
  'male_casualsuit03',
  'male_casualsuit04',
  'male_casualsuit05',
  'male_casualsuit06',
  'male_elegantsuit01',
  'male_worksuit01',
  'shoes01',
  'shoes02',
  'shoes03',
  'shoes04',
  'shoes05',
  'shoes06',
  'fedora01',
  'fedora_cocked',
  'afro01',
  'bob01',
  'bob02',
  'braid01',
  'long01',
  'ponytail01',
  'short01',
  'short02',
  'short03',
  'short04',
  ...Array.from(
    { length: 12 },
    (_, i) => `eyebrow${String(i + 1).padStart(3, '0')}`
  ),
  'teeth_base',
  'tongue01',
]

const KIND: Record<string, AssetKind> = {
  clothes: 'garment',
  hair: 'hair',
  eyebrows: 'brows',
  beard: 'beard',
  teeth: 'teeth',
  tongue: 'tongue',
}

/** `characterLicences`, provisionally: see the top of this file. */
export function provisionalLicences(
  character: Character,
  pack: HumanPack
): LicenceEntry[] {
  const m = pack.manifest
  const from = `${m.source.repo} at ${m.source.commit}, via the tosijs hm08 human pack (version ${m.version})`
  const table = new Map<string, LicenceEntry>()
  const add = (e: LicenceEntry): void => {
    table.set(e.asset, e)
  }
  add({
    asset: `makehuman:base/${m.base}`,
    title: `MakeHuman ${m.base} base body`,
    kind: 'base',
    ...CC0,
    source: from,
    author: 'The MakeHuman team',
    modified: true,
  })
  for (const part of ['eyes', 'eyelashes'] as const)
    add({
      asset: `makehuman:part/${part}`,
      title: `MakeHuman ${part}`,
      kind: part,
      ...CC0,
      source: from,
      author: 'The MakeHuman team',
      modified: true,
    })
  for (const name of MAKEHUMAN_SYSTEM_PROXIES) {
    const p = m.proxies?.[name]
    if (p === undefined) continue
    add({
      asset: `makehuman:proxy/${name}`,
      title: `MakeHuman ${name}`,
      kind: KIND[p.category] ?? 'other',
      ...CC0,
      source: `MakeHuman system assets (makehuman-assets), via the tosijs hm08 human pack (version ${m.version})`,
      author: 'The MakeHuman team',
      modified: true,
    })
  }
  add({
    asset: 'monk:skin-tone/monk-skin-tone-scale',
    title: 'Monk Skin Tone Scale',
    kind: 'skin-tone',
    licence: 'CC-BY-4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://skintone.google',
    author: 'Dr. Ellis Monk and Google',
    attribution:
      'Monk Skin Tone Scale by Dr. Ellis Monk and Google, licensed under CC BY 4.0 (https://skintone.google)',
  })
  return assetsUsed(character, pack).map((asset) => {
    const e = table.get(asset)
    if (e === undefined) throw new UnlicensedAssetError(asset)
    return e
  })
}
