import { describe, expect, test } from 'bun:test'
import pkg from '../../package.json'
import { DEFAULT_HUMAN_BODY } from 'tosijs-3d/human-morph'
import {
  CHARACTER_SLOTS,
  DEFAULT_CHARACTER,
  HM08_PACK_PATH,
  HM08_PACK_VERSION,
} from 'tosijs-3d/character-settings'
import {
  BUILD_SETTINGS,
  DEFAULTS,
  HM08_PACK_URL,
  readSettings,
  SLOTS,
} from './settings'
import { DRAMATIS_VERSION } from './version'

const character = (settings: Record<string, unknown>) => ({
  name: 't',
  settings,
  cloth: {},
  tailor: [],
  garments: {},
})

describe('readSettings', () => {
  test("fills in tosijs-3d's DEFAULT_CHARACTER", () => {
    const d = DEFAULT_CHARACTER
    const s = readSettings(character({}))
    expect(s.body).toEqual({ ...DEFAULT_HUMAN_BODY, gender: d.gender })
    expect(s.tone).toBe(d.tone)
    expect(s.redness).toBe(d.redness)
    const worn = CHARACTER_SLOTS.filter((k) => d[k] !== 'none')
    expect(s.slots).toEqual(Object.fromEntries(worn.map((k) => [k, d[k]])))
    const named = (v: string) => (v === 'none' ? null : v)
    expect([s.hair, s.brows, s.beard, s.moustache]).toEqual(
      [d.hair, d.brows, d.beard, d.moustache].map(named)
    )
    expect(s.source).toBe(d.source)
    expect(s.irisColour).toBe(d.irisColour)
    expect(s.eyeStyle).toBe('basic')
  })

  test("the defaults are tosijs-3d's, plus Dramatis's eyeStyle", () => {
    expect(SLOTS).toBe(CHARACTER_SLOTS)
    for (const [key, value] of Object.entries(BUILD_SETTINGS))
      if (key !== 'eyeStyle')
        expect([key, value]).toEqual([key, DEFAULT_CHARACTER[key]])
    expect(DEFAULTS.eyeStyle).toBe('basic')
  })

  test('every default the build reads exists upstream, of the type the build expects', () => {
    // Comparing against DEFAULT_CHARACTER alone passes if tosijs-3d renames
    // or drops a key (undefined === undefined): this catches it.
    const numbers = new Set(['gender', 'tone', 'redness'])
    for (const [key, value] of Object.entries(DEFAULTS))
      expect([key, typeof value]).toEqual([
        key,
        numbers.has(key) ? 'number' : 'string',
      ])
  })

  test("the pack URL is the CDN's, at tosijs-3d's path and version", () => {
    expect(HM08_PACK_URL).toBe(
      `https://cdn.tosijs.net/${HM08_PACK_PATH}?v=${HM08_PACK_VERSION}`
    )
    // The string the samples and docs were made with.
    expect(HM08_PACK_URL).toBe(
      'https://cdn.tosijs.net/makehuman/hm08/hm08.json?v=18'
    )
  })

  test('reads sliders, slots, none and colourways', () => {
    const s = readSettings({
      ...character({
        weight: 1,
        gender: 0,
        outfit: 'none',
        top: 'female_casualsuit02',
        hair: 'none',
        tone: 'dark',
      }),
      cloth: {
        top: { look: 'red', material: {} },
        shoes: { look: 'as made', material: {} },
      },
    })
    expect(s.body.weight).toBe(1)
    expect(s.body.gender).toBe(0)
    expect(s.slots).toEqual({ top: 'female_casualsuit02', shoes: 'shoes01' })
    expect(s.looks).toEqual({ top: 'red' })
    expect(s.hair).toBeNull()
    // Not a number: the default.
    expect(s.tone).toBe(0.3)
  })
})

test("the generator version is package.json's", () => {
  expect(DRAMATIS_VERSION).toBe(pkg.version)
})
