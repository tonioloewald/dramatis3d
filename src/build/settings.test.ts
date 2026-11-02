import { describe, expect, test } from 'bun:test'
import pkg from '../../package.json'
import { DEFAULT_HUMAN_BODY } from 'tosijs-3d/human-morph'
import { readSettings } from './settings'
import { DRAMATIS_VERSION } from './version'

const character = (settings: Record<string, unknown>) => ({
  name: 't',
  settings,
  cloth: {},
  tailor: [],
  garments: {},
})

describe('readSettings', () => {
  test("fills in tosijs-3d's DEFAULT_CHARACTER (a copy: character.ts is Babylon)", () => {
    const s = readSettings(character({}))
    expect(s.body).toEqual({ ...DEFAULT_HUMAN_BODY, gender: 1 })
    expect(s.tone).toBe(0.3)
    expect(s.redness).toBe(0.5)
    expect(s.slots).toEqual({ outfit: 'male_casualsuit02', shoes: 'shoes01' })
    expect([s.hair, s.brows, s.beard, s.moustache]).toEqual([
      'short02',
      'eyebrow001',
      null,
      null,
    ])
    expect(s.source).toBe('MakeHuman')
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
