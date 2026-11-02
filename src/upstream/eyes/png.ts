// A small PNG codec for baking textures in plain code (no canvas): reads the
// 8-bit, non-interlaced RGB and RGBA images a browser writes, and writes RGBA.
// Built on fflate's zlib. Bound for tosijs-3d with the rest of baked materials
// (upstream:tosijs-3d).

import { unzlibSync, zlibSync } from 'fflate'

/** An image as RGBA bytes, row by row from the top. */
export interface Rgba {
  width: number
  height: number
  data: Uint8Array
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Read a PNG: 8-bit RGB (colour type 2) or RGBA (6), not interlaced. */
export function decodePng(png: Uint8Array): Rgba {
  for (let i = 0; i < 8; i++)
    if (png[i] !== SIGNATURE[i]) throw new Error('png: not a PNG')
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let width = 0
  let height = 0
  let colourType = 0
  const idat: Uint8Array[] = []
  for (let at = 8; at < png.length; ) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    const body = png.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
      const depth = body[8]
      colourType = body[9]!
      if (depth !== 8 || (colourType !== 2 && colourType !== 6) || body[12])
        throw new Error(
          `png: only 8-bit RGB/RGBA, not interlaced (depth ${depth}, colour type ${colourType})`
        )
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    at += 12 + length
  }
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0))
  let o = 0
  for (const c of idat) {
    joined.set(c, o)
    o += c.length
  }
  const raw = unzlibSync(joined)
  const bpp = colourType === 6 ? 4 : 3
  const stride = width * bpp
  const pixels = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = pixels.subarray(y * stride, (y + 1) * stride)
    const up = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp]! : 0
      const b = up ? up[x]! : 0
      const c = up && x >= bpp ? up[x - bpp]! : 0
      let v = src[x]!
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filter !== 0) throw new Error(`png: bad filter ${filter}`)
      row[x] = v & 0xff
    }
  }
  if (bpp === 4) return { width, height, data: pixels }
  const data = new Uint8Array(width * height * 4)
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    data[j] = pixels[i]!
    data[j + 1] = pixels[i + 1]!
    data[j + 2] = pixels[i + 2]!
    data[j + 3] = 255
  }
  return { width, height, data }
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, body.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(body, 8)
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)))
  return out
}

/** Write an RGBA image as a PNG (filter Up on every row but the first). */
export function encodePng(image: Rgba): Uint8Array {
  const { width, height, data } = image
  const stride = width * 4
  const raw = new Uint8Array(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const row = data.subarray(y * stride, (y + 1) * stride)
    const o = y * (stride + 1)
    if (y === 0) {
      raw[o] = 0
      raw.set(row, o + 1)
      continue
    }
    raw[o] = 2 // Up: smooth images deflate far better
    const up = data.subarray((y - 1) * stride, y * stride)
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = (row[x]! - up[x]!) & 0xff
  }
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, width)
  v.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  const parts = [
    Uint8Array.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
