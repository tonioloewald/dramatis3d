// Eye textures for the export: Tonio Loewald's CC0 eye art, fetched from the
// CDN (cdn.tosijs.net/tonio/eyes, from static-assets), its iris recoloured to
// the character's eye colour, as a PNG; and the UVs that map each eyeball onto
// it. Plain code: no canvas, no engine. Part of baked materials, bound for
// tosijs-3d (upstream:tosijs-3d, dramatis3d #3727).

import { decodePng, encodePng } from './png'
import { parseHex, recolourIris } from './recolour'
import { EYE_STYLES, eyePngUrl, type EyeStyle } from './textures'
import { ONE_EYE_LAYOUT } from './eye-uv'

export { eyeUvs, ONE_EYE_LAYOUT } from './eye-uv'
export {
  EYE_STYLES,
  EYE_VERSION,
  eyePngUrl,
  eyeSvgUrl,
  type EyeStyle,
} from './textures'

/** The licence id of a style's art: `tonio:eye/basic`. */
export const eyeAsset = (style: EyeStyle): string => `tonio:eye/${style}`

/** A style name as given, or `basic`. */
export function eyeStyle(v: unknown): EyeStyle {
  return EYE_STYLES.includes(v as EyeStyle) ? (v as EyeStyle) : 'basic'
}

/**
 * The eye art (a PNG, as fetched from `eyePngUrl`) with its iris in
 * `irisColour` (`#rrggbb`). An unreadable colour leaves the art as it is.
 */
export function recolourEyePng(
  art: Uint8Array,
  irisColour: string
): Uint8Array {
  const colour = parseHex(irisColour)
  if (colour === null) return art
  return encodePng(recolourIris(decodePng(art), colour, ONE_EYE_LAYOUT))
}
