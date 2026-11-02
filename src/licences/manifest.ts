// The licence manifest's data: every asset Dramatis ships or references, and
// the community assets it does not (unchecked, so excluded). Lane
// share-licence. Page: site/docs/licences.md (written from this by
// src/licences/write-page.ts).

import type { AssetKind, LicenceEntry } from '../contracts/licences'
import { PACKS } from './packs'

export const CC0 = 'CC0-1.0'
export const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/'
export const CC_BY_4 = 'CC-BY-4.0'
export const CC_BY_4_URL = 'https://creativecommons.org/licenses/by/4.0/'

const MH_COMMIT = PACKS.pack.source.commit
const MH_REPO = PACKS.pack.source.repo
const MH_DATA = `${MH_REPO}/tree/${MH_COMMIT}/makehuman/data`
const MH_AUTHOR = 'MakeHuman (makehumancommunity.org)'

const QUATERNIUS = 'Quaternius'
const UAL_PAGE = 'https://quaternius.com/packs/universalanimationlibrary.html'
const UBC_PAGE = 'https://quaternius.com/packs/universalbasecharacters.html'

/** An asset id's name part: lower case, and nothing but [a-z0-9_.-]. */
export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')

const proxyKind = (category: string): AssetKind =>
  category === 'clothes'
    ? 'garment'
    : category === 'eyebrows'
    ? 'brows'
    : category === 'hair' ||
      category === 'beard' ||
      category === 'teeth' ||
      category === 'tongue'
    ? category
    : 'other'

export const proxyId = (name: string): string => `makehuman:proxy/${slug(name)}`
export const lookId = (proxy: string, look: string): string =>
  `makehuman:look/${slug(proxy)}/${slug(look)}`
export const hairId = (piece: string): string =>
  `quaternius:hair/${slug(piece)}`

const cc0 = (
  e: Omit<LicenceEntry, 'licence' | 'licenceUrl'>
): LicenceEntry => ({ ...e, licence: CC0, licenceUrl: CC0_URL })

// ---- MakeHuman: the base, its data, its system assets ----------------------

const MAKEHUMAN_CORE: LicenceEntry[] = [
  cc0({
    asset: 'makehuman:base/hm08',
    title:
      'MakeHuman hm08 base mesh, its macro and detail targets, joint helpers and skeleton',
    kind: 'base',
    source: MH_DATA,
    author: MH_AUTHOR,
    modified: true,
  }),
  cc0({
    asset: 'makehuman:expression/face-poseunits',
    title: 'MakeHuman face pose units (baked into the 59 face units)',
    kind: 'other',
    source: `${MH_DATA}/poseunits`,
    author: MH_AUTHOR,
    modified: true,
  }),
  cc0({
    asset: 'makehuman:part/eyes',
    title: 'MakeHuman low-poly eyes',
    kind: 'eyes',
    source: `${MH_DATA}/eyes/low-poly`,
    author: MH_AUTHOR,
    modified: true,
  }),
  cc0({
    asset: 'makehuman:part/eyelashes',
    title: "MakeHuman eyelashes (the base mesh's eyelash helpers)",
    kind: 'eyelashes',
    source: `${MH_DATA}/3dobjs`,
    author: MH_AUTHOR,
    modified: true,
  }),
]

/** Proxies from MakeHuman's own system assets (CC0, 2020). */
const MAKEHUMAN_SYSTEM: LicenceEntry[] = Object.entries(PACKS.proxies)
  .filter(([, p]) => p.pack === 'system')
  .map(([name, p]) =>
    cc0({
      asset: proxyId(name),
      title: `MakeHuman ${name} (${p.category})`,
      kind: proxyKind(p.category),
      source: PACKS.packZips.system,
      author: MH_AUTHOR,
      // Textures resized to 1024 px; the binding is converted to metres.
      modified: true,
    })
  )

// ---- Quaternius ------------------------------------------------------------

const QUATERNIUS_ENTRIES: LicenceEntry[] = [
  cc0({
    asset: 'quaternius:skeleton/ual',
    title:
      "Universal Animation Library's 65-joint skeleton: names, hierarchy and joint frames (every export's skeleton)",
    kind: 'other',
    source: UAL_PAGE,
    author: QUATERNIUS,
  }),
  cc0({
    asset: 'quaternius:animation/ual1',
    title: 'Universal Animation Library, volume 1 (animation clips)',
    kind: 'animation',
    source: UAL_PAGE,
    author: QUATERNIUS,
    modified: true,
  }),
  ...PACKS.quaternius.pieces.map((piece) =>
    cc0({
      asset: hairId(piece),
      title: /^Reference_Head/.test(piece)
        ? `Quaternius ${piece} (the head the hair is fitted from)`
        : `Quaternius ${piece}, with its hair textures`,
      kind: /^Reference_Head/.test(piece)
        ? 'other'
        : /^Eyebrows/.test(piece)
        ? 'brows'
        : /Beard|Moustache|MuttonChops/.test(piece)
        ? 'beard'
        : 'hair',
      source: UBC_PAGE,
      author: QUATERNIUS,
      // Fitted to the MakeHuman head (tosijs-3d hair-fit).
      modified: true,
    })
  ),
  cc0({
    asset: 'quaternius:base/superhero_male',
    title: 'Quaternius Superhero_Male_FullBody (a body besides MakeHuman)',
    kind: 'base',
    source: UBC_PAGE,
    author: QUATERNIUS,
  }),
  cc0({
    asset: 'quaternius:base/superhero_female',
    title: 'Quaternius Superhero_Female_FullBody (a body besides MakeHuman)',
    kind: 'base',
    source: UBC_PAGE,
    author: QUATERNIUS,
  }),
]

// ---- Blender Studio --------------------------------------------------------

const BLENDER_PAGE = 'https://www.blender.org/download/demo-files/#assets'
const BLENDER_AUTHOR =
  'Blender Studio and community contributors (Blender Foundation)'
const BLENDER_ENTRIES: LicenceEntry[] = ['female', 'male'].map((g) =>
  cc0({
    asset: `blender:base/body-${g}-realistic`,
    title: `Blender Human Base Meshes v1.4.1, realistic ${g} body (a body besides MakeHuman)`,
    kind: 'base',
    source: BLENDER_PAGE,
    author: BLENDER_AUTHOR,
    // Exported at base level, moved to the origin, smooth-shaded.
    modified: true,
  })
)

// ---- Monk Skin Tone Scale --------------------------------------------------

export const MONK_ATTRIBUTION =
  'Monk Skin Tone Scale by Dr. Ellis Monk and Google (https://skintone.google), ' +
  'licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). ' +
  'Dramatis interpolates between its ten tones.'

const MONK: LicenceEntry = {
  asset: 'monk:skin-tone/monk-skin-tone-scale',
  title: 'Monk Skin Tone Scale (the ten tones the skin dial runs through)',
  kind: 'skin-tone',
  licence: CC_BY_4,
  licenceUrl: CC_BY_4_URL,
  source: 'https://skintone.google',
  author: 'Dr. Ellis Monk and Google',
  attribution: MONK_ATTRIBUTION,
  modified: true,
}

// ---- Tonio Loewald's eye art ------------------------------------------------

/** The eye textures (assets/tonio/eyes), original art, CC0; the iris is recoloured. */
const TONIO_EYES: LicenceEntry[] = (['basic', 'anime'] as const).map(
  (style) => ({
    asset: `tonio:eye/${style}`,
    title: `Eye texture, ${style} (the iris recoloured to the character's)`,
    kind: 'texture',
    licence: CC0,
    licenceUrl: CC0_URL,
    source: `https://cdn.tosijs.net/tonio/eyes/${style}-eye.svg`,
    author: 'Tonio Loewald',
    modified: true,
  })
)

/** Every asset Dramatis ships or references, checked. */
export const MANIFEST: readonly LicenceEntry[] = Object.freeze(
  [
    ...MAKEHUMAN_CORE,
    ...MAKEHUMAN_SYSTEM,
    MONK,
    ...TONIO_EYES,
    ...QUATERNIUS_ENTRIES,
    ...BLENDER_ENTRIES,
  ].map((e) => Object.freeze(e))
)

// ---- Community assets: listed, unchecked, excluded ------------------------

/**
 * A community asset in the packs: what its pack DECLARES (author, licence,
 * page), recorded as read, never as verified. It has no manifest entry until
 * a person has checked it (the page, the files, any original it was made
 * from), so the creator must not offer it and an export refuses it.
 */
export interface CommunityAsset {
  asset: string
  title: string
  kind: AssetKind
  /** The pack it came in (MakeHuman's asset-pack site). */
  pack: string
  packUrl: string
  /** What the pack's metadata says, verbatim: not checked. */
  declared: {
    author: string
    license: string
    source: string
    original_author?: string
    original_source?: string
  } | null
  status: 'unchecked'
}

const zips = PACKS.packZips as Record<string, string>

export const COMMUNITY: readonly CommunityAsset[] = Object.freeze([
  ...Object.entries(PACKS.proxies)
    .filter(([, p]) => p.pack !== 'system')
    .map(
      ([name, p]): CommunityAsset => ({
        asset: proxyId(name),
        title: name,
        kind: proxyKind(p.category),
        pack: p.pack,
        packUrl: zips[p.pack] ?? '',
        declared: p.declared,
        status: 'unchecked',
      })
    ),
  ...Object.entries(PACKS.proxies).flatMap(([name, p]) =>
    Object.entries(('looks' in p ? p.looks : undefined) ?? {}).map(
      ([look, l]): CommunityAsset => ({
        asset: lookId(name, look),
        title: `${name}, look "${look}" (${l.material})`,
        kind: 'texture',
        pack: l.pack,
        packUrl: zips[l.pack] ?? '',
        declared: l.declared,
        status: 'unchecked',
      })
    )
  ),
])
