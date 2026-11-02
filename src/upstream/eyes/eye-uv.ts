// UVs for a MakeHuman eyes part on a one-eye texture (assets/tonio/eyes).
// Each eye's centre is tosijs-3d's `eyeCentre` (rigged-body); the mapping is
// Dramatis's own, after tosijs-3d's `eyeUvs` but not a copy: glTF's handedness
// (+x, not -x), v down, and both eyes in one part mapped onto one picture.
//
// AN EYE'S UVS ARE MADE, NOT READ (tosijs-3d's words): each point goes by its
// angle from straight ahead (+Z, where the body faces) and its direction round
// that axis. The iris (about 29° across the radius) lands on the texture's
// iris disc, the sclera round it, out to a ring where the back of the eye,
// unseen in the socket, gathers. Both eyes map onto the same picture, the
// same way round, so a glint sits on the same side of each.

import { eyeCentre } from 'tosijs-3d/rigged-body'

/** Where the texture's iris is: its centre (u, v down from the top) and radius. */
export interface EyeLayout {
  at: { u: number; v: number }
  iris: number
}

/** The one-eye layout of assets/tonio/eyes: iris radius 48 at (128, 128) of 256. */
export const ONE_EYE_LAYOUT: EyeLayout = Object.freeze({
  at: Object.freeze({ u: 0.5, v: 0.5 }),
  iris: 48 / 256,
})

/**
 * UVs (glTF's convention: v down from the top) for an eyes part holding both
 * eyeballs, `positions` xyz with the body facing +Z and its left at +X. Each
 * vertex goes with the eye on its side of x = 0.
 */
export function eyeUvs(
  positions: ArrayLike<number>,
  layout: EyeLayout = ONE_EYE_LAYOUT,
  options: { irisDeg?: number; back?: number } = {}
): Float32Array {
  const n = positions.length / 3
  const irisAngle = ((options.irisDeg ?? 29) * Math.PI) / 180
  const back = options.back ?? layout.iris * 2.5
  // Each side's centre: the middle of its bounds (tosijs-3d's eyeCentre).
  const side = (i: number) => (positions[i * 3]! >= 0 ? 0 : 1)
  const sides: number[][] = [[], []]
  for (let i = 0; i < n; i++)
    sides[side(i)]!.push(
      positions[i * 3]!,
      positions[i * 3 + 1]!,
      positions[i * 3 + 2]!
    )
  const centre = sides.map((p) => {
    const { centre: c } = eyeCentre({
      positions: Float32Array.from(p),
      indices: new Uint32Array(0),
    })
    return [c.x, c.y, c.z]
  })
  const out = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const c = centre[side(i)]!
    const x = positions[i * 3]! - c[0]!
    const y = positions[i * 3 + 1]! - c[1]!
    const z = positions[i * 3 + 2]! - c[2]!
    const across = Math.hypot(x, y)
    const r = Math.min(back, (layout.iris * Math.atan2(across, z)) / irisAngle)
    // glTF is right-handed: seen from the front, +X (the character's left) is
    // on the viewer's RIGHT, so +X runs toward the picture's right. (tosijs-3d's
    // eyeUvs has -x: it maps for Babylon, which is left-handed.)
    const cos = across > 1e-9 ? x / across : 0
    const sin = across > 1e-9 ? y / across : 0
    out[i * 2] = layout.at.u + r * cos
    out[i * 2 + 1] = layout.at.v - r * sin // v down: up on the eye is up in the picture
  }
  return out
}
