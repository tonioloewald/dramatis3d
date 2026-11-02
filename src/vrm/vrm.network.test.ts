// The VRM export from a character file, through the public contract
// (`exportCharacterVrm`), on a real build. Network tier, like
// src/build/build.network.test.ts: it reads the hm08 pack from the CDN
// (cached in .cache/cdn/), so it is off by default; run it with
//
//   DRAMATIS_NETWORK=1 bun test src/vrm
//
// Without the variable each test is registered as skipped under a name
// starting NOT RUN, so the summary says so.

import { describe, expect, test } from 'bun:test'
import type { Character } from 'tosijs-3d/character-file'
import { type HumanPack, loadHumanPack } from 'tosijs-3d/human-pack'
import { cachedFetch, HM08_PACK_URL } from '../build/cdn'
import { exportCharacterGlb, exportCharacterVrm } from '../contracts'
import { validatorErrors } from '../../test/gate1/checks'
import { vrmFromGlb, vrmProblems } from '.'
import { readGlb } from '../upstream/glb/glb-chunks'

const ON = process.env.DRAMATIS_NETWORK === '1'
const it = (name: string, fn: () => Promise<void>, timeout = 180_000): void =>
  ON
    ? test(name, fn, timeout)
    : test.skip(`NOT RUN (set DRAMATIS_NETWORK=1): ${name}`, fn, timeout)

const fetcher = cachedFetch()
let packPromise: Promise<HumanPack> | null = null
const pack = (): Promise<HumanPack> =>
  (packPromise ??= loadHumanPack(HM08_PACK_URL, fetcher))

const character: Character = {
  name: 'VRM sample',
  settings: {
    gender: 0.3,
    age: 0.4,
    tone: 0.5,
    outfit: 'female_casualsuit01',
    shoes: 'shoes02',
    hair: 'short02',
    brows: 'eyebrow006',
  },
  cloth: {},
  tailor: [],
  garments: {},
}

describe('exportCharacterVrm', () => {
  it('is exportCharacterGlb (ue, T-pose) plus VRMC_vrm, and passes the checks', async () => {
    const p = await pack()
    const vrm = await exportCharacterVrm(character, p, {
      fetch: fetcher,
      meta: { authors: ['Network test'] },
    })
    const glb = await exportCharacterGlb(character, p, { fetch: fetcher })
    expect(
      Buffer.from(vrm).equals(
        Buffer.from(vrmFromGlb(glb, { authors: ['Network test'] }))
      )
    ).toBe(true)
    expect(vrmProblems(vrm)).toEqual([])
    expect(await validatorErrors(vrm)).toEqual([])
    const ext = readGlb(vrm).json.extensions.VRMC_vrm
    expect(ext.meta.name).toBe('VRM sample')
    expect(Object.keys(ext.expressions.preset).length).toBe(17)
    expect(ext.lookAt.type).toBe('expression')
  })

  it('without face units: a valid VRM with no expressions and no look-at', async () => {
    const vrm = await exportCharacterVrm(character, await pack(), {
      fetch: fetcher,
      faceUnits: false,
    })
    expect(vrmProblems(vrm)).toEqual([])
    const ext = readGlb(vrm).json.extensions.VRMC_vrm
    expect(ext.expressions.preset).toEqual({})
    expect(ext.lookAt).toBeUndefined()
  })
})
