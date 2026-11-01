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
import { SAMPLES } from '../../bin/export-sample'
import {
  clipProblems,
  morphProblems,
  skeletonProblems,
  validatorErrors,
} from '../../test/gate1/checks'
import { clipBytes } from '../../test/gate1/fixture'
import { readGlb } from '../../test/gate1/glb'
import { UnlicensedAssetError } from '../contracts/licences'
import { UE_JOINT_NAMES } from '../contracts/profile'
import { buildCharacterWith } from './build'
import { cachedFetch, HM08_PACK_URL } from './cdn'
import { provisionalLicences } from './provisional-licences'
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
const deps = { licences: provisionalLicences }
const OUT = join(import.meta.dir, '..', '..', 'samples', 'out')

describe('build from the CDN', () => {
  for (const [name, sample] of Object.entries(SAMPLES))
    it(`samples/out/${name}.glb is what its character file builds today`, async () => {
      const doc = await Bun.file(join(OUT, `${name}.character.json`)).text()
      const { character } = readCharacter(doc, {
        settings: { ...BUILD_SETTINGS },
      })
      const built = await buildCharacterWith(
        character,
        await pack(),
        { fetch: fetcher },
        deps
      )
      const bytes = writeCharacterGlb(built, {
        naming: sample.naming ?? 'ue',
      })
      const committed = new Uint8Array(
        await Bun.file(join(OUT, `${name}.glb`)).arrayBuffer()
      )
      expect(bytes.byteLength).toBe(committed.byteLength)
      expect(Buffer.compare(bytes, committed)).toBe(0)
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
