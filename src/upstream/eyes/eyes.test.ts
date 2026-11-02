import { describe, expect, test } from 'bun:test'
import { decodePng, encodePng } from './png'
import { parseHex, recolourIris } from './recolour'
import { eyeTexturePng, eyeUvs, eyeStyle, eyeAsset, ONE_EYE_LAYOUT } from '.'
import { EYE_PNG } from './textures'

const art = (style: 'basic' | 'anime') =>
  decodePng(Uint8Array.from(atob(EYE_PNG[style]), (c) => c.charCodeAt(0)))
const px = (img: { width: number; data: Uint8Array }, x: number, y: number) =>
  Array.from(
    img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)
  )

describe('the PNG codec', () => {
  test('the embedded art decodes: 256 square, opaque', () => {
    const img = art('basic')
    expect([img.width, img.height]).toEqual([256, 256])
    expect(img.data[3]).toBe(255)
  })

  test('what it writes, it reads back exactly', () => {
    const img = art('anime')
    const again = decodePng(encodePng(img))
    expect(again.width).toBe(img.width)
    expect(Buffer.compare(again.data, img.data)).toBe(0)
  })

  test('it refuses what is not an 8-bit RGB(A) PNG', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(
      'not a PNG'
    )
  })
})

describe('recolouring the iris', () => {
  const blue = [0x3f, 0x6f, 0xa0] as const

  test('the browns turn the target colour; the pupil, glints and sclera stay', () => {
    for (const style of ['basic', 'anime'] as const) {
      const before = art(style)
      const after = recolourIris(before, blue, ONE_EYE_LAYOUT)
      // The sclera, outside the iris disc, is untouched.
      expect(px(after, 128, 10)).toEqual(px(before, 128, 10))
      // The pupil (black, in the middle) is untouched.
      expect(px(after, 128, 128)).toEqual(px(before, 128, 128))
      // Somewhere in the iris was brown (red over blue) and is now blue.
      let browns = 0
      let blues = 0
      for (let y = 85; y < 172; y++)
        for (let x = 85; x < 172; x++) {
          const [r0, , b0] = px(before, x, y)
          const [r1, , b1] = px(after, x, y)
          if (r0! > b0! + 30) browns++
          if (r0! > b0! + 30 && b1! > r1!) blues++
        }
      expect(browns).toBeGreaterThan(500)
      expect(blues / browns).toBeGreaterThan(0.95)
    }
  })

  test('the anime glints stay white', () => {
    const before = art('anime')
    const after = recolourIris(before, blue, ONE_EYE_LAYOUT)
    let whites = 0
    for (let y = 80; y < 176; y++)
      for (let x = 80; x < 176; x++) {
        const p = px(before, x, y)
        if (p.every((c) => c > 245)) {
          whites++
          expect(px(after, x, y)).toEqual(p)
        }
      }
    expect(whites).toBeGreaterThan(20)
  })

  test('colours are read as #rrggbb; anything else leaves the art', () => {
    expect(parseHex('#5a3519')).toEqual([0x5a, 0x35, 0x19])
    expect(parseHex('blue')).toBeNull()
    const own = eyeTexturePng('basic', 'not a colour')
    expect(
      Buffer.compare(
        own,
        Uint8Array.from(atob(EYE_PNG.basic), (c) => c.charCodeAt(0))
      )
    ).toBe(0)
  })

  test('styles and their licence ids', () => {
    expect(eyeStyle('anime')).toBe('anime')
    expect(eyeStyle('cartoon')).toBe('basic')
    expect(eyeStyle(undefined)).toBe('basic')
    expect(eyeAsset('anime')).toBe('tonio:eye/anime')
  })
})

describe('eye UVs (tosijs-3d’s mapping)', () => {
  // Two eyeballs of radius 1 cm, left at +X, right at -X, facing +Z.
  const ball = (cx: number) => {
    const out: number[] = []
    for (let a = 0; a <= 180; a += 15)
      for (let b = 0; b < 360; b += 30) {
        const t = (a * Math.PI) / 180
        const p = (b * Math.PI) / 180
        out.push(
          cx + 0.01 * Math.sin(t) * Math.cos(p),
          1.6 + 0.01 * Math.sin(t) * Math.sin(p),
          0.08 + 0.01 * Math.cos(t)
        )
      }
    return out
  }
  const positions = new Float32Array([...ball(0.03), ...ball(-0.03)])
  const uv = eyeUvs(positions)
  const at = (x: number, y: number, z: number) => {
    let best = 0
    let d = Infinity
    for (let i = 0; i < positions.length / 3; i++) {
      const e = Math.hypot(
        positions[i * 3]! - x,
        positions[i * 3 + 1]! - y,
        positions[i * 3 + 2]! - z
      )
      if (e < d) {
        d = e
        best = i
      }
    }
    return [uv[best * 2]!, uv[best * 2 + 1]!]
  }
  const { iris } = ONE_EYE_LAYOUT

  test('straight ahead is the iris’s centre, on both eyes', () => {
    for (const cx of [0.03, -0.03]) {
      const [u, v] = at(cx, 1.6, 0.09)
      expect(u).toBeCloseTo(0.5, 5)
      expect(v).toBeCloseTo(0.5, 5)
    }
  })

  test('up on the eye is up in the picture (v down), 30° out is about the iris rim', () => {
    const t = (30 * Math.PI) / 180
    const [u, v] = at(0.03, 1.6 + 0.01 * Math.sin(t), 0.08 + 0.01 * Math.cos(t))
    expect(u).toBeCloseTo(0.5, 5)
    expect(v).toBeCloseTo(0.5 - (iris * 30) / 29, 3)
  })

  test('the back of the eye gathers on a ring inside the picture', () => {
    for (let i = 0; i < uv.length; i++) {
      expect(uv[i]!).toBeGreaterThan(0)
      expect(uv[i]!).toBeLessThan(1)
    }
  })
})
