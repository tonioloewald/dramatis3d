import { describe, expect, test } from 'bun:test'
import { deflateSync } from 'fflate'
import { writeCharacter, type Character } from 'tosijs-3d/character-file'
import {
  canonicalMaterial,
  MATERIAL_COLLECTIONS,
} from 'tosijs-3d/material-recipe'
import {
  decodeShareLink as contractDecode,
  encodeShareLink as contractEncode,
  SHARE_LINK_BUDGET,
} from '../contracts'
import {
  decodeShareLink,
  encodeShareLink,
  fromBase64Url,
  SHARE_INFLATED_LIMIT,
  toBase64Url,
} from '.'

/*
A TYPICAL CHARACTER: every setting tosijs-3d's character builder has
(DEFAULT_CHARACTER at 0.11.6, copied as data because `tosijs-3d/character`
imports Babylon), moved off its defaults the way a person using the creator
moves them, dressed in four slots with fabric recipes.
*/
const DEFAULTS: Record<string, unknown> = {
  gender: 1,
  age: 0.5,
  muscle: 0.5,
  weight: 0.5,
  height: 0.5,
  proportions: 0.5,
  african: 1 / 3,
  asian: 1 / 3,
  caucasian: 1 / 3,
  chestDepth: 0.5,
  pecs: 0.5,
  waist: 0.5,
  bustSize: 0.5,
  bustFirmness: 0.5,
  tone: 0.3,
  redness: 0.5,
  iris: 0.2,
  irisColour: '#5a3519',
  hair: 'short02',
  beard: 'none',
  moustache: 'none',
  brows: 'eyebrow001',
  hairBase: '#4a3122',
  hairHighlight: '#9a6b43',
  hairUp: 0,
  hairForward: 0,
  hairSize: 1,
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
  stubble: 0,
  blink: true,
  talk: false,
  smile: 0,
  browsUp: 0,
  frown: 0,
  hideClothes: false,
  rigs: {},
  surfaces: {},
  source: 'MakeHuman',
}
const SLOTS = [
  'outfit',
  'bodysuit',
  'armour',
  'top',
  'bottom',
  'shoes',
  'gloves',
  'hat',
  'mask',
  'glasses',
]
const fabric = (name: string, albedo: string) => {
  const preset = MATERIAL_COLLECTIONS.fabrics!.presets.find(
    (p) => p.name === name
  )!
  return canonicalMaterial({
    type: 'cloth',
    inputs: { ...preset.recipe.inputs, albedo },
  })
}
const DEFAULT_SLOTS = Object.fromEntries(
  SLOTS.map((s) => [
    s,
    { look: 'as made', material: fabric('cotton', '#ffffff') },
  ])
)

// Sliders as people leave them: arbitrary floats, not round numbers.
const typical = (): Character => ({
  name: 'Ada Lovelace',
  settings: {
    ...DEFAULTS,
    gender: 0.1372,
    age: 0.4419,
    muscle: 0.6183,
    weight: 0.4297,
    height: 0.5824,
    proportions: 0.6631,
    african: 0.2071,
    asian: 0.1145,
    caucasian: 0.6784,
    chestDepth: 0.4412,
    waist: 0.3871,
    bustSize: 0.5532,
    bustFirmness: 0.6127,
    tone: 0.4283,
    redness: 0.5617,
    iris: 0.3349,
    irisColour: '#3b6e8f',
    hair: 'long01',
    brows: 'eyebrow006',
    hairBase: '#2c1f17',
    hairHighlight: '#6b4a32',
    hairUp: 0.0042,
    hairSize: 1.0175,
    outfit: 'none',
    top: 'toigo_fisherman_sweater',
    bottom: 'toigo_wool_pants',
    shoes: 'toigo_ankle_boots_female',
    glasses: 'toigo_round_glasses_leopard',
    smile: 0.2468,
  },
  cloth: {
    ...DEFAULT_SLOTS,
    top: { look: 'as made', material: fabric('wool', '#7a4b3a') },
    bottom: { look: 'as made', material: fabric('wool', '#2b2f3a') },
    shoes: { look: 'as made', material: fabric('leather', '#3a2418') },
    glasses: { look: 'as made', material: fabric('synthetic', '#1a1a1a') },
  },
  tailor: [],
  garments: {},
})

const defaults = { settings: DEFAULTS, slots: DEFAULT_SLOTS }

describe('share link: round trip', () => {
  test('a typical character comes back as it went', () => {
    const c = typical()
    const link = encodeShareLink(c)
    expect(
      link.url.startsWith('https://dramatis.tosijs.net/creator/#c=1.')
    ).toBe(true)
    expect(link.fragment).toBe(link.url.slice(link.url.indexOf('#') + 1))
    expect(link.dropped).toEqual([])
    const back = decodeShareLink(link.url, defaults)
    expect(back.warnings).toEqual([])
    expect(back.character).toEqual(c)
  })

  test('the contract entry points are these', () => {
    const link = contractEncode(typical())
    expect(contractDecode(link.url, defaults).character).toEqual(typical())
  })

  test('reads a whole URL, a fragment with or without #, or the payload', () => {
    const link = encodeShareLink(typical(), {
      base: 'http://localhost:8020/creator/?x=1#old',
    })
    expect(link.url.startsWith('http://localhost:8020/creator/?x=1#c=1.')).toBe(
      true
    )
    const payload = link.fragment.slice('c=1.'.length)
    for (const input of [
      link.url,
      link.fragment,
      `#${link.fragment}`,
      `1.${payload}`,
      `#other=2&${link.fragment}&more`,
    ])
      expect(decodeShareLink(input, defaults).character).toEqual(typical())
  })

  test('the same character makes the same link', () => {
    expect(encodeShareLink(typical()).url).toBe(encodeShareLink(typical()).url)
  })

  test('garments, tailor outlines and file bodies are dropped, and said so', () => {
    const c: Character = {
      ...typical(),
      tailor: [
        [
          [0, 1],
          [0.2, 1.1],
        ],
      ],
      garments: { cape: new Uint8Array([1, 2, 3]) },
      bodies: {
        Mine: { file: { name: 'mine.glb', bytes: new Uint8Array(10) } },
        Hosted: { url: 'https://cdn.tosijs.net/x.glb', pick: 'Body' },
      },
    }
    const link = encodeShareLink(c)
    expect(link.dropped).toHaveLength(3)
    expect(link.dropped.join('\n')).toContain('garment cape')
    expect(link.dropped.join('\n')).toContain('tailor')
    expect(link.dropped.join('\n')).toContain('body Mine')
    const back = decodeShareLink(link.url, defaults).character
    expect(back.garments).toEqual({})
    expect(back.tailor).toEqual([])
    expect(back.bodies).toEqual({
      Hosted: { url: 'https://cdn.tosijs.net/x.glb', pick: 'Body' },
    })
  })

  test('settings the page lacks are skipped with a warning (readCharacter)', () => {
    const link = encodeShareLink({
      ...typical(),
      settings: { ...typical().settings, fromTheFuture: 3 },
    })
    const back = decodeShareLink(link.url, defaults)
    expect(back.warnings).toEqual([
      'fromTheFuture: not a setting here; skipped',
    ])
    expect('fromTheFuture' in back.character.settings).toBe(false)
  })

  test('base64url is reversible on every byte', () => {
    const all = new Uint8Array(256 * 3).map((_, i) => i % 256)
    for (let n = 0; n < 8; n++) {
      const bytes = all.subarray(0, all.length - n)
      const text = toBase64Url(bytes)
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/)
      expect(fromBase64Url(text)).toEqual(bytes)
    }
  })
})

describe('share link: size', () => {
  test('a typical character, measured', () => {
    const link = encodeShareLink(typical())
    const json = JSON.stringify(writeCharacter(typical()))
    // Measured at 0.11.6 and recorded on site/docs/licences.md. If this
    // moves a lot, update the page.
    console.log(
      `share link: typical character ${json.length} B of JSON -> ` +
        `${link.fragment.length - 4} chars of payload, ${
          link.url.length
        } chars of URL ` +
        `(budget ${SHARE_LINK_BUDGET})`
    )
    expect(link.url.length).toBeLessThan(2000)
  })

  test('everything worn, every slot recoloured, measured', () => {
    const c = typical()
    const worn: Record<string, string> = {
      outfit: 'male_elegantsuit01',
      bodysuit: 'matcreator_mc-bodysuit-2021',
      armour: 'matcreator_mc-scifi-armor_helios',
      top: 'toigo_fisherman_sweater',
      bottom: 'toigo_wool_pants',
      shoes: 'toigo_ankle_boots_female',
      gloves: 'toigo_gloves_long',
      hat: 'fedora01',
      mask: 'culturalibre_hero_mask_1',
      glasses: 'toigo_round_glasses_leopard',
    }
    const names = MATERIAL_COLLECTIONS.fabrics!.presets.map((p) => p.name)
    const cloth = Object.fromEntries(
      SLOTS.map((s, i) => [
        s,
        {
          look: s === 'outfit' ? 'blue pinstripe with paisley tie' : 'as made',
          material: fabric(
            names[i % names.length]!,
            `#${((i * 0x2f4b1d) & 0xffffff).toString(16).padStart(6, '0')}`
          ),
        },
      ])
    )
    const full: Character = {
      ...c,
      settings: {
        ...c.settings,
        ...worn,
        beard: 'wdg_scruffy_beard',
        moustache: 'rehmanpolanski_moustache_viking',
      },
      cloth,
    }
    const link = encodeShareLink(full)
    console.log(
      `share link: everything worn ${link.url.length} chars of URL (budget ${SHARE_LINK_BUDGET})`
    )
    expect(decodeShareLink(link.url, defaults).character).toEqual(full)
    expect(link.url.length).toBeLessThan(SHARE_LINK_BUDGET / 2)
  })

  test('over the budget is an error, not a truncated link', () => {
    const settings: Record<string, unknown> = { ...typical().settings }
    // Incompressible: random strings in settings the page might have.
    for (let i = 0; i < 400; i++)
      settings[`k${i}`] = crypto.randomUUID() + crypto.randomUUID()
    expect(() => encodeShareLink({ ...typical(), settings })).toThrow(
      /over the 8000 budget/
    )
  })
})

describe('share link: garbage is refused', () => {
  const refuse = (input: string, why: RegExp) =>
    expect(() => decodeShareLink(input, defaults)).toThrow(why)

  test('not a link', () => {
    refuse('', /not a Dramatis share link/)
    refuse('hello world', /not a Dramatis share link/)
    refuse('https://dramatis.tosijs.net/creator/', /not a Dramatis share link/)
    refuse('https://example.com/#foo=bar', /no "c="/)
    refuse('#c=', /not a Dramatis share link/)
    refuse('#c=1.', /not a Dramatis share link/)
    refuse('#c=1.ab+cd', /not a Dramatis share link/)
    refuse('#c=x.abcd', /not a Dramatis share link/)
  })

  test('a newer link version', () => {
    const link = encodeShareLink(typical())
    refuse(link.fragment.replace('c=1.', 'c=2.'), /newer than this page/)
  })

  test('bad base64url, not deflate, truncated', () => {
    refuse('#c=1.a', /not base64url/)
    refuse(
      `#c=1.${toBase64Url(new Uint8Array([255, 255, 255, 255]))}`,
      /not deflated/
    )
    const payload = encodeShareLink(typical()).fragment.slice(4)
    refuse(
      `#c=1.${payload.slice(0, (payload.length >> 3) * 4)}`,
      /truncated|not deflated/
    )
  })

  const pack = (value: string | Uint8Array) =>
    `#c=1.${toBase64Url(
      deflateSync(
        typeof value === 'string' ? new TextEncoder().encode(value) : value
      )
    )}`

  test('deflated, but not a character', () => {
    refuse(pack(new Uint8Array([0xff, 0xfe, 0x80])), /not UTF-8/)
    refuse(pack('{not json'), /not JSON/)
    refuse(pack('[1,2,3]'), /not a character document/)
    refuse(
      pack('{"format":"something-else","version":1}'),
      /not a character document/
    )
    refuse(pack('{"format":"tosijs-character"}'), /no version/)
    refuse(
      pack('{"format":"tosijs-character","version":99,"settings":{}}'),
      /newer than this page reads/
    )
  })

  test('a deflate bomb is stopped before it is parsed', () => {
    const bomb = new Uint8Array(SHARE_INFLATED_LIMIT * 8).fill(32)
    refuse(pack(bomb), /inflates past/)
  })

  test('a hand-made link carrying garments or file bodies: not decoded', () => {
    const doc = writeCharacter({
      ...typical(),
      garments: { cape: new Uint8Array([1, 2, 3]) },
      bodies: { Mine: { file: { name: 'm.glb', bytes: new Uint8Array(4) } } },
    })
    const back = decodeShareLink(pack(JSON.stringify(doc)), defaults)
    expect(back.character.garments).toEqual({})
    expect(back.character.bodies).toBeUndefined()
    expect(back.warnings).toEqual([
      'garments: a share link carries none; 1 skipped',
      'body Mine: a share link carries no files; skipped',
    ])
  })

  test('wrong-typed settings keep their defaults (readCharacter)', () => {
    const doc = {
      ...writeCharacter(typical()),
      settings: { ...typical().settings, height: 'tall', hair: 7 },
    }
    const back = decodeShareLink(pack(JSON.stringify(doc)), defaults)
    expect(back.character.settings.height).toBe(0.5)
    expect(back.character.settings.hair).toBe('short02')
    expect(back.warnings).toHaveLength(2)
  })
})
