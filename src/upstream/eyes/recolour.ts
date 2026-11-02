// The iris recoloured to a character's eye colour, in plain code. The eye art
// (assets/tonio/eyes) paints the iris in browns; inside the iris disc, every
// pixel with a brown's colour takes the target colour at its own lightness,
// so the fibres, the darkening and the rim survive. Greys (the pupil, the
// glints) and everything outside the disc are left alone.

import type { Rgba } from './png'
import type { EyeLayout } from './eye-uv'

/** The art's middle iris brown (#8c6239): it becomes the target colour exactly. */
const BASE = [0x8c, 0x62, 0x39] as const
const luma = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b

/** `#rrggbb` to 0..255 channels, or null. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** A copy of `image` with its iris browns turned to `colour` (0..255 RGB). */
export function recolourIris(
  image: Rgba,
  colour: readonly [number, number, number],
  layout: EyeLayout
): Rgba {
  const { width, height } = image
  const data = image.data.slice()
  const cx = layout.at.u * width
  const cy = layout.at.v * height
  const radius = layout.iris * width + 1.5
  const baseLuma = luma(BASE[0], BASE[1], BASE[2])
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > radius) continue
      const i = (y * width + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const max = Math.max(r, g, b)
      const sat = max > 0 ? (max - Math.min(r, g, b)) / max : 0
      // How much of a brown this is: the art's browns run 0.45 to 0.8.
      const w = Math.min(1, Math.max(0, (sat - 0.12) / 0.25))
      if (w === 0) continue
      const k = luma(r, g, b) / baseLuma
      for (let c = 0; c < 3; c++) {
        const to = Math.min(255, colour[c]! * k)
        data[i + c] = Math.round(data[i + c]! * (1 - w) + to * w)
      }
    }
  return { width, height, data }
}
