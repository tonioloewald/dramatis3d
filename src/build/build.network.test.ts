// THE NETWORK TIER: builds from the hm08 pack on the CDN (cached in
// .cache/cdn/ after the first run). Off by default, so `bun test` stays
// offline; run it with
//
//   DRAMATIS_NETWORK=1 bun test src/build
//
// Without the variable each test is registered as skipped under a name
// starting NOT RUN, so the summary says so.

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readCharacter } from 'tosijs-3d/character-file'
import { type HumanPack, loadHumanPack } from 'tosijs-3d/human-pack'
import { clipsOf, heldOf, SAMPLES } from '../../bin/export-sample'
import {
  clipProblems,
  morphProblems,
  skeletonProblems,
  validatorErrors,
} from '../../test/gate1/checks'
import { clipBytes } from '../../test/gate1/fixture'
import { glbDifferences } from '../../test/glb-equivalent'
import { readGlb } from 'tosijs-3d/glb-chunks'
import { characterLicences, UnlicensedAssetError } from '../contracts/licences'
import { CHECKED_GARMENTS } from '../licences/manifest'
import { UE_JOINT_NAMES } from '../contracts/profile'
import { buildCharacterWith } from './build'
import { cachedFetch, HM08_PACK_URL } from './cdn'
import { BUILD_SETTINGS } from './settings'
import { writeCharacterGlb } from './write'

const ON = process.env.DRAMATIS_NETWORK === '1'
const it = (name: string, fn: () => Promise<void>, timeout: number): void =>
  ON
    ? test(name, fn, timeout)
    : test.skip(`NOT RUN (set DRAMATIS_NETWORK=1): ${name}`, fn, timeout)

const fetcher = cachedFetch()
let packPromise: Promise<HumanPack> | null = null
const pack = (): Promise<HumanPack> =>
  (packPromise ??= loadHumanPack(HM08_PACK_URL, fetcher))
const deps = { licences: characterLicences }
const OUT = join(import.meta.dir, '..', '..', 'samples', 'out')

describe('build from the CDN', () => {
  it('without the eye art (a fetch that serves only the pack), the eyes go plain and the export goes on', async () => {
    const doc = await Bun.file(
      join(OUT, 'clothed-casual.character.json')
    ).text()
    const { character } = readCharacter(doc, {
      settings: { ...BUILD_SETTINGS },
    })
    const packOnly = async (url: string) => {
      if (url.includes('/tonio/eyes/')) throw new Error('not in this mirror')
      return fetcher(url)
    }
    const built = await buildCharacterWith(
      character,
      await pack(),
      { fetch: packOnly },
      deps
    )
    const eyes = built.meshes.find((m) => m.name === 'eyes')!
    expect(eyes.uvs).toBeNull()
    const material = built.materials[eyes.material]!
    expect(material.baseColorTexture).toBeUndefined()
    expect(material.baseColorFactor.slice(0, 3)).toEqual([0.85, 0.85, 0.82])
    expect(built.images.some((i) => i.asset.startsWith('tonio:eye/'))).toBe(
      false
    )
    // And with it, the eyes are textured.
    const withArt = await buildCharacterWith(
      character,
      await pack(),
      { fetch: fetcher },
      deps
    )
    const textured = withArt.meshes.find((m) => m.name === 'eyes')!
    expect(textured.uvs).not.toBeNull()
    expect(withArt.images.some((i) => i.asset === 'tonio:eye/basic')).toBe(true)
  }, 120_000)

  for (const [name, sample] of Object.entries(SAMPLES))
    it(`samples/out/${name}.glb is what its character file builds today`, async () => {
      const doc = await Bun.file(join(OUT, `${name}.character.json`)).text()
      // Read with the settings the export reads too (what it carries).
      const { character } = readCharacter(doc, {
        settings: {
          ...BUILD_SETTINGS,
          exportClips: [],
          held: 'none',
          grips: {},
        },
      })
      const built = await buildCharacterWith(
        character,
        await pack(),
        { fetch: fetcher },
        deps
      )
      // The clips and the held item it carries are in its file too.
      const held = await heldOf(character, fetcher)
      const bytes = writeCharacterGlb(built, {
        naming: sample.naming ?? 'ue',
        clips: clipsOf(character),
        ...(held ? { held } : {}),
      })
      const committed = new Uint8Array(
        await Bun.file(join(OUT, `${name}.glb`)).arrayBuffer()
      )
      // Equivalent, not byte-identical: libm differs between macOS and Linux, so
      // the last float bits (and the printed JSON bounds) can too. See
      // test/glb-equivalent.ts.
      expect(glbDifferences(bytes, committed)).toEqual([])
    }, 120_000)

  it("restPose 'source' keeps MakeHuman's arms down, and still passes the gate's checks", async () => {
    const character = SAMPLES['clothed-casual']!.character
    const built = await buildCharacterWith(
      character,
      await pack(),
      { fetch: fetcher, restPose: 'source' },
      deps
    )
    expect(built.restPose).toBe('source')
    const at = (n: string) =>
      built.skeleton.joints[UE_JOINT_NAMES.indexOf(n)]!.position
    expect(at('hand_l')[1]).toBeLessThan(at('upperarm_l')[1] - 0.2)
    const bytes = writeCharacterGlb(built)
    expect(await validatorErrors(bytes)).toEqual([])
    expect(skeletonProblems(readGlb(bytes))).toEqual([])
    expect(await clipProblems(bytes, await clipBytes())).toEqual([])
  }, 120_000)

  it('faceUnits: false writes no targets; a list writes only those', async () => {
    const character = SAMPLES['long-hair']!.character
    const none = await buildCharacterWith(
      character,
      await pack(),
      { fetch: fetcher, faceUnits: false },
      deps
    )
    expect(none.faceUnits).toEqual([])
    expect(none.meshes.every((m) => m.morphs.length === 0)).toBe(true)
    const some = await buildCharacterWith(
      character,
      await pack(),
      { fetch: fetcher, faceUnits: ['JawDrop', 'LeftUpperLidClosed'] },
      deps
    )
    expect(some.faceUnits).toEqual(['LeftUpperLidClosed', 'JawDrop'])
    const glb = readGlb(writeCharacterGlb(some))
    expect(morphProblems(glb)).toEqual([])
    const body = some.meshes.find((m) => m.name === 'body')!
    expect(body.morphs.map((m) => m.name)).toEqual([
      'LeftUpperLidClosed',
      'JawDrop',
    ])
  }, 120_000)

  // The starter wardrobe (src/licences/manifest.ts CHECKED_GARMENTS): every
  // checked community garment builds, exports clean through gate 1's checks,
  // and carries its own licence entry. The looks cover all of them.
  const WARDROBE_LOOKS: Record<string, string>[] = [
    {
      top: 'elvs_crude_t-shirt_male',
      bottom: 'cortu_cargo_pants',
      shoes: 'toigo_mj_cloth_shoes',
      gloves: 'toigo_gloves_short',
      hat: 'aethelraed_unraed_cloche_hat',
    },
    {
      top: 'joepal_crude_t-shirt_female',
      bottom: 'cortu_jeans_shorts',
      shoes: 'cortu_t-bar',
    },
    {
      top: 'toigo_bodice-style_top',
      bottom: 'toigo_wool_pants',
      shoes: 'toigo_flats',
    },
    { top: 'toigo_fisherman_sweater', bottom: 'toigo_wool_pants' },
    { outfit: 'toigo_suit_with_dinner_jacket' },
    { bodysuit: 'matcreator_mc-bodysuit-2021' },
  ]

  it('the looks wear every checked garment', async () => {
    const worn = new Set(WARDROBE_LOOKS.flatMap((l) => Object.values(l)))
    expect([...worn].sort()).toEqual(Object.keys(CHECKED_GARMENTS).sort())
  }, 5_000)

  for (const look of WARDROBE_LOOKS)
    it(`the starter wardrobe exports: ${Object.values(look).join(
      ', '
    )}`, async () => {
      const base = SAMPLES['clothed-casual']!.character
      const settings: Record<string, unknown> = {
        ...base.settings,
        outfit: 'none',
      }
      for (const slot of [
        'top',
        'bottom',
        'shoes',
        'gloves',
        'hat',
        'bodysuit',
      ])
        settings[slot] = 'none'
      const built = await buildCharacterWith(
        { ...base, settings: { ...settings, ...look } },
        await pack(),
        { fetch: fetcher },
        deps
      )
      const ids = built.licences.map((l) => l.asset)
      for (const name of Object.values(look))
        expect(ids).toContain(`makehuman:proxy/${name}`)
      const bytes = writeCharacterGlb(built)
      expect(await validatorErrors(bytes)).toEqual([])
      const glb = readGlb(bytes)
      expect(skeletonProblems(glb)).toEqual([])
      expect(morphProblems(glb)).toEqual([])
    }, 120_000)

  it('an asset without a licence entry stops the build', async () => {
    const character = {
      ...SAMPLES['clothed-casual']!.character,
      settings: {
        ...SAMPLES['clothed-casual']!.character.settings,
        outfit: 'none',
        bottom: 'toigo_harem_pants',
      },
    }
    let error: unknown = null
    try {
      await buildCharacterWith(
        character,
        await pack(),
        { fetch: fetcher },
        deps
      )
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(UnlicensedAssetError)
    expect((error as UnlicensedAssetError).asset).toBe(
      'makehuman:proxy/toigo_harem_pants'
    )
  }, 120_000)
})
