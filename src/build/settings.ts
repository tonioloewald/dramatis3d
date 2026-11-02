// A character file's settings, read for the build: the body's sliders, the
// skin, and what it wears. The keys and their defaults are tosijs-3d's
// `DEFAULT_CHARACTER` (character.ts), which lives in a Babylon module and so
// cannot be imported here; the defaults below are a copy of its values, and
// settings.test.ts lists them so a change there is a visible diff here.

import type { Character } from 'tosijs-3d/character-file'
import { DEFAULT_HUMAN_BODY, type MacroBody } from 'tosijs-3d/human-morph'

/** What can be worn, one of each (tosijs-3d's `CHARACTER_SLOTS`). */
export const SLOTS = [
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
] as const
export type Slot = (typeof SLOTS)[number]

/** The non-slider defaults the build reads (tosijs-3d's `DEFAULT_CHARACTER`). */
export const DEFAULTS = {
  gender: 1,
  tone: 0.3,
  redness: 0.5,
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
  gloves: 'none',
  hat: 'none',
  mask: 'none',
  glasses: 'none',
  source: 'MakeHuman',
} as const

/**
 * Every setting the build reads, with its default: `readCharacter`'s
 * `defaults.settings` (it keeps only the keys it is given).
 */
export const BUILD_SETTINGS: Readonly<Record<string, unknown>> = Object.freeze({
  ...DEFAULT_HUMAN_BODY,
  ...DEFAULTS,
})

/**
 * The hm08 pack the creator loads (tosijs-3d's `loadCharacterAssets`), for
 * `loadHumanPack`: its manifest's URL, which carries the pack version.
 */
export const HM08_PACK_URL =
  'https://cdn.tosijs.net/makehuman/hm08/hm08.json?v=17'

/** The proxies every MakeHuman character carries, inside the mouth. */
export const MOUTH = { teeth: 'teeth_base', tongue: 'tongue01' } as const

export interface BuildSettings {
  body: MacroBody
  tone: number
  redness: number
  /** Worn, by slot: a pack proxy's name. Slots worn as `none` are absent. */
  slots: Partial<Record<Slot, string>>
  /** A colourway per slot (`Character.cloth[slot].look`), when not `as made`. */
  looks: Partial<Record<Slot, string>>
  hair: string | null
  brows: string | null
  beard: string | null
  moustache: string | null
  /** `MakeHuman`, or a mesh body's source name (not exportable yet). */
  source: string
}

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d
const name = (v: unknown, d: string): string | null => {
  const s = typeof v === 'string' ? v : d
  return s === 'none' || s === '' ? null : s
}

/** The settings the build uses, defaults filled in. */
export function readSettings(character: Character): BuildSettings {
  const s = character.settings
  const body = { ...DEFAULT_HUMAN_BODY } as MacroBody
  const record = body as unknown as Record<string, number>
  for (const key of Object.keys(DEFAULT_HUMAN_BODY))
    record[key] = num(s[key], record[key] ?? 0)
  body.gender = num(s.gender, DEFAULTS.gender)
  const slots: Partial<Record<Slot, string>> = {}
  const looks: Partial<Record<Slot, string>> = {}
  for (const slot of SLOTS) {
    const worn = name(s[slot], DEFAULTS[slot])
    if (worn !== null) slots[slot] = worn
    const look = character.cloth?.[slot]?.look
    if (typeof look === 'string' && look !== 'as made') looks[slot] = look
  }
  return {
    body,
    tone: num(s.tone, DEFAULTS.tone),
    redness: num(s.redness, DEFAULTS.redness),
    slots,
    looks,
    hair: name(s.hair, DEFAULTS.hair),
    brows: name(s.brows, DEFAULTS.brows),
    beard: name(s.beard, DEFAULTS.beard),
    moustache: name(s.moustache, DEFAULTS.moustache),
    source: typeof s.source === 'string' ? s.source : DEFAULTS.source,
  }
}
