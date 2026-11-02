// Where the eye art is: on the CDN, not in this repo. Tonio Loewald's CC0 eye
// textures live in static-assets (assets/tonio/eyes), served at
// cdn.tosijs.net/tonio/eyes/; bin/eye-textures.ts renders their PNGs.

/** The eye styles, as `eyeStyle` names them. */
export const EYE_STYLES = ['basic', 'anime'] as const
export type EyeStyle = (typeof EYE_STYLES)[number]

/**
 * Bumped whenever the PNGs' bytes change: the CDN caches files as immutable,
 * so new art needs a new URL (as the human pack's `?v=` does).
 */
export const EYE_VERSION = 1

/** A style's PNG (256 × 256) on the CDN. */
export const eyePngUrl = (style: EyeStyle): string =>
  `https://cdn.tosijs.net/tonio/eyes/${style}-eye.png?v=${EYE_VERSION}`

/** A style's SVG, the art itself, on the CDN. */
export const eyeSvgUrl = (style: EyeStyle): string =>
  `https://cdn.tosijs.net/tonio/eyes/${style}-eye.svg`
