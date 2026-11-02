// Eye textures for the export: Tonio Loewald's CC0 eye art (assets/tonio/eyes),
// its iris recoloured to the character's eye colour, as a PNG, and the UVs
// that map each eyeball onto it. Plain code: no canvas, no engine. Part of
// baked materials, bound for tosijs-3d (upstream:tosijs-3d).

import { decodePng, encodePng } from './png'
import { parseHex, recolourIris } from './recolour'
import { EYE_PNG, EYE_STYLES, type EyeStyle } from './textures'
import { ONE_EYE_LAYOUT } from './eye-uv'

export { eyeUvs, ONE_EYE_LAYOUT } from './eye-uv'
export { EYE_STYLES, type EyeStyle } from './textures'

/** The licence id of a style's art: `tonio:eye/basic`. */
export const eyeAsset = (style: EyeStyle): string => `tonio:eye/${style}`

/** A style name as given, or `basic`. */
export function eyeStyle(v: unknown): EyeStyle {
  return EYE_STYLES.includes(v as EyeStyle) ? (v as EyeStyle) : 'basic'
}

function base64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * A style's eye as a PNG, its iris in `irisColour` (`#rrggbb`). An unreadable
 * colour leaves the art's own brown.
 */
export function eyeTexturePng(style: EyeStyle, irisColour: string): Uint8Array {
  const art = base64(EYE_PNG[style])
  const colour = parseHex(irisColour)
  if (colour === null) return art
  return encodePng(recolourIris(decodePng(art), colour, ONE_EYE_LAYOUT))
}
