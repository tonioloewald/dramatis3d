// A character file's settings, read for the build: the body's sliders, the
// skin, and what it wears. The keys and their defaults are tosijs-3d's
// (`tosijs-3d/character-settings`: `DEFAULT_CHARACTER`, `CHARACTER_SLOTS`,
// the hm08 pack's path and version); the build reads the subset below.

import type { Character } from 'tosijs-3d/character-file'
import {
  CHARACTER_SLOTS,
  DEFAULT_CHARACTER,
  HM08_PACK_PATH,
  HM08_PACK_VERSION,
} from 'tosijs-3d/character-settings'
import { DEFAULT_HUMAN_BODY, type MacroBody } from 'tosijs-3d/human-morph'
import { eyePngUrl, eyeStyle, type EyeStyle } from 'tosijs-3d/eye-art'

/** What can be worn, one of each: tosijs-3d's `CHARACTER_SLOTS`. */
export const SLOTS = CHARACTER_SLOTS
export type Slot = (typeof SLOTS)[number]

/** The non-slider settings the build reads, besides the slots. */
const READ = [
  'gender',
  'tone',
  'redness',
  'hair',
  'beard',
  'moustache',
  'brows',
  ...SLOTS,
  'source',
  'irisColour',
] as const

/**
 * The non-slider defaults the build reads: tosijs-3d's `DEFAULT_CHARACTER`,
 * plus Dramatis's own `eyeStyle` (which eye art, tosijs-3d/eye-art).
 */
export const DEFAULTS = Object.freeze({
  ...(Object.fromEntries(READ.map((k) => [k, DEFAULT_CHARACTER[k]])) as {
    gender: number
    tone: number
    redness: number
    source: string
    irisColour: string
  } & Record<'hair' | 'beard' | 'moustache' | 'brows' | Slot, string>),
  eyeStyle: 'basic' as EyeStyle,
})

/**
 * Every setting the build reads, with its default: `readCharacter`'s
 * `defaults.settings` (it keeps only the keys it is given).
 */
export const BUILD_SETTINGS: Readonly<Record<string, unknown>> = Object.freeze({
  ...DEFAULT_HUMAN_BODY,
  ...DEFAULTS,
})

/**
 * The hm08 pack the creator loads, for `loadHumanPack`: its manifest's URL,
 * which carries the pack version. tosijs-3d's `hm08PackUrl()` resolves against
 * a global asset base the library never sets, so the CDN is named here.
 */
export const HM08_PACK_URL = `https://cdn.tosijs.net/${HM08_PACK_PATH}?v=${HM08_PACK_VERSION}`

/**
 * The eye art's URL. tosijs-3d's `eyePngUrl` resolves against the same global
 * asset base, so where no page has set one (a script, a server, an adopter's
 * bundle) it is resolved against the CDN here; a set base passes through.
 */
export function eyeArtUrl(style: EyeStyle): string {
  return new URL(eyePngUrl(style), 'https://cdn.tosijs.net/').href
}

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
  /** The iris colour, `#rrggbb`. */
  irisColour: string
  /** The eye art: `basic` or `anime`. */
  eyeStyle: EyeStyle
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
    irisColour:
      typeof s.irisColour === 'string' ? s.irisColour : DEFAULTS.irisColour,
    eyeStyle: eyeStyle(s.eyeStyle),
  }
}
