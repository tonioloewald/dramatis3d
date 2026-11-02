import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack, HumanPackManifest } from 'tosijs-3d/human-pack'
import {
  characterLicences as contractCharacterLicences,
  checkExportExtras,
  licenceManifest as contractManifest,
  UnlicensedAssetError as ContractError,
} from '../contracts'
import {
  characterLicences,
  communityAssets,
  licenceManifest,
  lookupLicence,
  UnlicensedAssetError,
} from '.'
import { hairId, lookId, proxyId } from './manifest'
import { PACKS } from './packs'
import { PAGE, renderPage } from './write-page'

describe('the licence page', () => {
  test('site/docs/licences.md shows the manifest as the code has it', () => {
    const page = readFileSync(PAGE, 'utf8')
    // Stale? Run: bun src/licences/write-page.ts
    expect(renderPage(page)).toBe(page)
    for (const e of licenceManifest()) expect(page).toContain(`\`${e.asset}\``)
  })
})

const manifest = licenceManifest()
const community = communityAssets()
const listed = new Set([
  ...manifest.map((e) => e.asset),
  ...community.map((c) => c.asset),
])

/** Every asset id the packs reference, from the snapshot. */
function referenced(): string[] {
  const ids = ['makehuman:base/hm08', 'makehuman:expression/face-poseunits']
  for (const part of PACKS.pack.parts) ids.push(`makehuman:part/${part}`)
  for (const [name, p] of Object.entries(PACKS.proxies)) {
    ids.push(proxyId(name))
    for (const look of Object.keys(('looks' in p ? p.looks : null) ?? {}))
      ids.push(lookId(name, look))
  }
  for (const piece of PACKS.quaternius.pieces) ids.push(hairId(piece))
  return ids
}

describe('licence manifest', () => {
  test('every asset the packs reference is listed: in the manifest, or as an unchecked community asset', () => {
    const missing = referenced().filter((id) => !listed.has(id))
    expect(missing).toEqual([])
  })

  test('nothing is both shipped and unchecked', () => {
    const shipped = new Set(manifest.map((e) => e.asset))
    expect(community.filter((c) => shipped.has(c.asset))).toEqual([])
  })

  test('ids are unique, lower case, <source>:<kind>/<name>', () => {
    const ids = [...manifest, ...community].map((e) => e.asset)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+:[a-z-]+\/[a-z0-9_.\/-]+$/)
  })

  test('every entry is complete; CC BY carries its credit, CC0 none', () => {
    for (const e of manifest) {
      expect(e.title).not.toBe('')
      expect(e.author).not.toBe('')
      expect(e.source).toMatch(/^https:\/\//)
      expect(e.licenceUrl).toMatch(/^https:\/\/creativecommons\.org\//)
      expect(['CC0-1.0', 'CC-BY-4.0']).toContain(e.licence)
      if (e.licence.startsWith('CC-BY')) expect(e.attribution).toBeTruthy()
      else expect(e.attribution).toBeUndefined()
    }
  })

  test('the known assets have the known licences', () => {
    expect(lookupLicence('makehuman:base/hm08')?.licence).toBe('CC0-1.0')
    expect(lookupLicence('quaternius:animation/ual1')?.licence).toBe('CC0-1.0')
    expect(lookupLicence('quaternius:hair/hair_bob')?.licence).toBe('CC0-1.0')
    const monk = lookupLicence('monk:skin-tone/monk-skin-tone-scale')
    expect(monk?.licence).toBe('CC-BY-4.0')
    expect(monk?.attribution).toContain('Ellis Monk')
    expect(lookupLicence('makehuman:proxy/toigo_harem_pants')).toBeUndefined()
    expect(lookupLicence('nope')).toBeUndefined()
  })

  test('community assets are listed as unchecked, with what their pack declares', () => {
    expect(community.length).toBeGreaterThan(100)
    for (const c of community) {
      expect(c.status).toBe('unchecked')
      expect(c.packUrl).toMatch(/^https:\/\/files\.makehumancommunity\.org\//)
    }
    // Two "CC0" packs declare a CC BY asset: why each is checked by a person.
    const ccBy = community
      .filter((c) => c.declared?.license === 'CC-BY')
      .map((c) => c.asset)
    expect(ccBy.sort()).toEqual([
      'makehuman:proxy/culturalibre_hero_mask_5',
      'makehuman:proxy/culturalibre_heroine_boots_4',
    ])
  })

  test('the contract entry points are these', () => {
    expect(contractManifest()).toBe(manifest)
    expect(ContractError).toBe(UnlicensedAssetError)
    expect(contractCharacterLicences).toBe(characterLicences)
  })
})

// ---- the snapshot against the live pack -----------------------------------

const LOCAL_PACK = join(
  process.env.STATIC_ASSETS ??
    join(import.meta.dir, '..', '..', '..', 'static-assets'),
  'assets',
  PACKS.pack.path
)
const CDN_PACK = `https://cdn.tosijs.net/${PACKS.pack.path}?v=17`

async function livePackText(): Promise<{ text: string; from: string } | null> {
  if (existsSync(LOCAL_PACK))
    return { text: readFileSync(LOCAL_PACK, 'utf8'), from: LOCAL_PACK }
  try {
    const res = await fetch(CDN_PACK, { signal: AbortSignal.timeout(10_000) })
    if (res.ok) return { text: await res.text(), from: CDN_PACK }
  } catch {
    // offline: reported below
  }
  return null
}

describe('the snapshot matches the pack the creator loads', () => {
  test('hm08.json: every proxy, look and part is in the snapshot', async () => {
    const live = await livePackText()
    if (live == null) {
      console.warn(
        `NOT RUN: no static-assets checkout at ${LOCAL_PACK} and ${CDN_PACK} unreachable`
      )
      return
    }
    const m = JSON.parse(live.text) as HumanPackManifest
    const snap = PACKS.proxies as Record<
      string,
      { looks?: Record<string, unknown> }
    >
    const stale: string[] = []
    for (const [name, p] of Object.entries(m.proxies ?? {})) {
      if (snap[name] == null) stale.push(`proxy ${name}`)
      for (const look of Object.keys(p.material.looks ?? {}))
        if (snap[name]?.looks?.[look] == null)
          stale.push(`look ${name}/${look}`)
    }
    for (const part of Object.keys(m.parts ?? {}))
      if (!(PACKS.pack.parts as readonly string[]).includes(part))
        stale.push(`part ${part}`)
    if (stale.length)
      throw new Error(
        `${
          live.from
        } references assets the snapshot lacks (run bun src/licences/scan-packs.ts): ${stale.join(
          ', '
        )}`
      )
    if (
      createHash('sha256').update(live.text).digest('hex') !== PACKS.pack.sha256
    )
      console.warn(
        `licences: ${live.from} changed since the snapshot (no new assets); rescan when convenient`
      )
  })
})

// ---- characterLicences ----------------------------------------------------

const fakePack = (): HumanPack =>
  ({
    manifest: {
      parts: Object.fromEntries(PACKS.pack.parts.map((p) => [p, {}])),
      // The snapshot's proxies, shaped as the pack has them.
      proxies: Object.fromEntries(
        Object.entries(PACKS.proxies).map(([name, p]) => [
          name,
          {
            category: p.category,
            slot: 'slot' in p ? p.slot : undefined,
            material: {
              alpha: false,
              twoSided: false,
              looks: 'looks' in p ? p.looks : undefined,
            },
          },
        ])
      ),
    },
  } as unknown as HumanPack)

const SETTINGS = {
  source: 'MakeHuman',
  hair: 'short02',
  beard: 'none',
  moustache: 'none',
  brows: 'eyebrow001',
  outfit: 'male_casualsuit02',
  bodysuit: 'none',
  armour: 'none',
  top: 'none',
  bottom: 'none',
  shoes: 'shoes01',
  hat: 'none',
  glasses: 'none',
  gloves: 'none',
  mask: 'none',
  hideClothes: false,
}
const char = (
  settings: Record<string, unknown> = {},
  extra: Partial<Character> = {}
): Character => ({
  name: 'x',
  settings: { ...SETTINGS, ...settings },
  cloth: {},
  tailor: [],
  garments: {},
  ...extra,
})

describe('characterLicences', () => {
  test("tosijs-3d's default character: base first, each asset once", () => {
    const ids = characterLicences(char(), fakePack()).map((e) => e.asset)
    expect(ids[0]).toBe('makehuman:base/hm08')
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'makehuman:base/hm08',
      'makehuman:expression/face-poseunits',
      'makehuman:part/eyelashes',
      'makehuman:part/eyes',
      'makehuman:proxy/teeth_base',
      'makehuman:proxy/tongue01',
      'monk:skin-tone/monk-skin-tone-scale',
      'quaternius:skeleton/ual',
      'makehuman:proxy/short02',
      'makehuman:proxy/eyebrow001',
      'makehuman:proxy/male_casualsuit02',
      'makehuman:proxy/shoes01',
    ])
  })

  test('what it returns passes the export extras schema', () => {
    const licences = characterLicences(char(), fakePack())
    const problems = checkExportExtras({
      format: 'dramatis-character',
      profile: 1,
      naming: 'ue',
      restPose: 't-pose',
      faceUnits: [],
      character: {},
      licences,
    } as never).filter((p) => /licen/.test(p))
    expect(problems).toEqual([])
  })

  test('Quaternius hair resolves to its own entry', () => {
    const ids = characterLicences(
      char({ hair: 'Hair_Bob', brows: 'Eyebrows_Female' }),
      fakePack()
    ).map((e) => e.asset)
    expect(ids).toContain('quaternius:hair/hair_bob')
    expect(ids).toContain('quaternius:hair/eyebrows_female')
  })

  test('a community garment is refused: unchecked assets never ship', () => {
    expect(() =>
      characterLicences(char({ bottom: 'toigo_harem_pants' }), fakePack())
    ).toThrow(UnlicensedAssetError)
    try {
      characterLicences(char({ bottom: 'toigo_harem_pants' }), fakePack())
    } catch (e) {
      expect((e as UnlicensedAssetError).asset).toBe(
        'makehuman:proxy/toigo_harem_pants'
      )
    }
  })

  test('a community look on a system garment is refused', () => {
    expect(() =>
      characterLicences(
        char(
          { outfit: 'male_elegantsuit01' },
          { cloth: { outfit: { look: 'teal', material: {} } } }
        ),
        fakePack()
      )
    ).toThrow('makehuman:look/male_elegantsuit01/teal')
    // Worn as made, it is a system asset.
    expect(
      characterLicences(
        char(
          { outfit: 'male_elegantsuit01' },
          { cloth: { outfit: { look: 'as made', material: {} } } }
        ),
        fakePack()
      ).map((e) => e.asset)
    ).toContain('makehuman:proxy/male_elegantsuit01')
  })

  test('an unknown asset is refused', () => {
    expect(() =>
      characterLicences(char({ hat: 'mystery_hat' }), fakePack())
    ).toThrow('unknown:hat/mystery_hat')
  })

  test('hidden clothes are not exported, so they need no entry', () => {
    const ids = characterLicences(
      char({ bottom: 'toigo_harem_pants', hideClothes: true }),
      fakePack()
    ).map((e) => e.asset)
    expect(ids).not.toContain('makehuman:proxy/shoes01')
  })

  test("the user's own garment and body are listed with no licence claimed", () => {
    const licences = characterLicences(
      char(
        { source: 'My scan', outfit: 'my cape' },
        { garments: { 'my cape': new Uint8Array(1) } }
      ),
      fakePack()
    )
    expect(licences[0]!.asset).toBe('user:body/my_scan')
    expect(licences[0]!.licence).toBe('NOASSERTION')
    expect(licences.map((e) => e.asset)).toContain('user:garment/my_cape')
  })

  test('the hosted bodies besides MakeHuman have entries', () => {
    for (const source of [
      'Blender: female, realistic',
      'Blender: male, realistic',
      'Quaternius: superhero, male',
      'Quaternius: superhero, female',
    ]) {
      const [base] = characterLicences(char({ source }), fakePack())
      expect(base!.kind).toBe('base')
      expect(base!.licence).toBe('CC0-1.0')
    }
  })
})
