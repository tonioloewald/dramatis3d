// A GLB's two chunks, read and written. Test-side only: the harness reads
// exports with it and builds its fixtures with it. Not the exporter.

export interface Glb {
  // glTF JSON, as parsed: the harness looks, it does not type every field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any
  bin: Uint8Array | null
}

const MAGIC = 0x46546c67 // 'glTF'
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

/** Split a GLB into its JSON and binary chunk. Throws when it is not one. */
export function readGlb(bytes: Uint8Array): Glb {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 20 || dv.getUint32(0, true) !== MAGIC)
    throw new Error('not a GLB (bad magic)')
  if (dv.getUint32(4, true) !== 2) throw new Error('not a glTF 2.0 GLB')
  let offset = 12
  let json: unknown = undefined
  let bin: Uint8Array | null = null
  while (offset + 8 <= bytes.byteLength) {
    const length = dv.getUint32(offset, true)
    const type = dv.getUint32(offset + 4, true)
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === JSON_CHUNK) json = JSON.parse(new TextDecoder().decode(body))
    else if (type === BIN_CHUNK && bin === null) bin = body
    offset += 8 + length
  }
  if (json === undefined) throw new Error('GLB has no JSON chunk')
  return { json, bin }
}

function pad(bytes: Uint8Array, fill: number): Uint8Array {
  const n = (4 - (bytes.byteLength % 4)) % 4
  if (n === 0) return bytes
  const out = new Uint8Array(bytes.byteLength + n).fill(fill)
  out.set(bytes)
  return out
}

/** Write a GLB from JSON and an optional binary chunk (padded as the spec says). */
export function writeGlb(json: unknown, bin: Uint8Array | null): Uint8Array {
  const j = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20)
  const b = bin === null ? null : pad(bin, 0)
  const total = 12 + 8 + j.byteLength + (b === null ? 0 : 8 + b.byteLength)
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, MAGIC, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, j.byteLength, true)
  dv.setUint32(16, JSON_CHUNK, true)
  out.set(j, 20)
  if (b !== null) {
    const at = 20 + j.byteLength
    dv.setUint32(at, b.byteLength, true)
    dv.setUint32(at + 4, BIN_CHUNK, true)
    out.set(b, at + 8)
  }
  return out
}

const COMPONENT_BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
}
const TYPE_COUNT: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
}

/** An accessor's bytes, tightly packed (the fixtures and UAL never interleave). */
export function accessorBytes(glb: Glb, index: number): Uint8Array {
  const a = glb.json.accessors[index]
  const view = glb.json.bufferViews[a.bufferView]
  const size = COMPONENT_BYTES[a.componentType]! * TYPE_COUNT[a.type]!
  if (view.byteStride !== undefined && view.byteStride !== size)
    throw new Error(`accessor ${index} is interleaved`)
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return glb.bin!.subarray(start, start + a.count * size)
}

/** Builds a binary chunk: each `add` is a new buffer view, 4-byte aligned. */
export class BinBuilder {
  private parts: Uint8Array[] = []
  private length = 0
  readonly views: Array<{
    buffer: 0
    byteOffset: number
    byteLength: number
    target?: number
  }> = []

  /** Append bytes as a buffer view; returns its index. */
  add(bytes: Uint8Array, target?: number): number {
    const padded = pad(bytes, 0)
    const view: {
      buffer: 0
      byteOffset: number
      byteLength: number
      target?: number
    } = {
      buffer: 0,
      byteOffset: this.length,
      byteLength: bytes.byteLength,
    }
    if (target !== undefined) view.target = target
    this.views.push(view)
    this.parts.push(padded)
    this.length += padded.byteLength
    return this.views.length - 1
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.length)
    let at = 0
    for (const p of this.parts) {
      out.set(p, at)
      at += p.byteLength
    }
    return out
  }
}
