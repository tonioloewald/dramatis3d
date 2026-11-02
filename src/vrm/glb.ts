// A GLB's two chunks, read and written, and the few accessors VRM needs read
// back (positions and morph deltas). Pure: no DOM, no engine. The VRM writer
// takes a profile GLB, adds `VRMC_vrm` to its JSON and keeps its binary chunk
// byte for byte, so the geometry is exactly the GLB export's.

/** glTF JSON, as parsed. VRM reads a handful of fields; it does not type all of glTF. */
export type GltfJson = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface GlbChunks {
  json: GltfJson
  bin: Uint8Array
}

const MAGIC = 0x46546c67 // 'glTF'
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

/** Split a GLB into its JSON and binary chunk. Throws when it is not one. */
export function readGlbChunks(bytes: Uint8Array): GlbChunks {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 20 || dv.getUint32(0, true) !== MAGIC)
    throw new Error('vrm: not a GLB (bad magic)')
  if (dv.getUint32(4, true) !== 2) throw new Error('vrm: not a glTF 2.0 GLB')
  let offset = 12
  let json: GltfJson | undefined
  let bin: Uint8Array | undefined
  while (offset + 8 <= bytes.byteLength) {
    const length = dv.getUint32(offset, true)
    const type = dv.getUint32(offset + 4, true)
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === JSON_CHUNK && json === undefined)
      json = JSON.parse(new TextDecoder().decode(body)) as GltfJson
    else if (type === BIN_CHUNK && bin === undefined) bin = body
    offset += 8 + length
  }
  if (json === undefined) throw new Error('vrm: the GLB has no JSON chunk')
  return { json, bin: bin ?? new Uint8Array(0) }
}

function padded(bytes: Uint8Array, fill: number): Uint8Array {
  const n = (4 - (bytes.byteLength % 4)) % 4
  if (n === 0) return bytes
  const out = new Uint8Array(bytes.byteLength + n).fill(fill)
  out.set(bytes)
  return out
}

/** A GLB from JSON and a binary chunk, padded as the spec says. */
export function writeGlbChunks({ json, bin }: GlbChunks): Uint8Array {
  const j = padded(new TextEncoder().encode(JSON.stringify(json)), 0x20)
  const b = padded(bin, 0)
  const total =
    12 + 8 + j.byteLength + (b.byteLength > 0 ? 8 + b.byteLength : 0)
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, MAGIC, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, j.byteLength, true)
  dv.setUint32(16, JSON_CHUNK, true)
  out.set(j, 20)
  if (b.byteLength > 0) {
    const at = 20 + j.byteLength
    dv.setUint32(at, b.byteLength, true)
    dv.setUint32(at + 4, BIN_CHUNK, true)
    out.set(b, at + 8)
  }
  return out
}

const FLOAT = 5126
const UNSIGNED_SHORT = 5123
const UNSIGNED_INT = 5125
const UNSIGNED_BYTE = 5121

function view(g: GlbChunks, index: number): { at: number; length: number } {
  const v = g.json.bufferViews?.[index]
  if (v === undefined) throw new Error(`vrm: no bufferView ${index}`)
  if (v.byteStride !== undefined && v.byteStride !== 12)
    throw new Error(`vrm: bufferView ${index} is interleaved`)
  return { at: v.byteOffset ?? 0, length: v.byteLength }
}

function floats(g: GlbChunks, viewIndex: number, offset: number, n: number) {
  const { at } = view(g, viewIndex)
  const start = g.bin.byteOffset + at + offset
  return new Float32Array(g.bin.buffer.slice(start, start + n * 4))
}

/**
 * A float VEC3 accessor as xyz per element, sparse or not (a sparse one with
 * no `bufferView` starts from zeros, as glTF says).
 */
export function readVec3(g: GlbChunks, accessorIndex: number): Float32Array {
  const a = g.json.accessors?.[accessorIndex]
  if (a === undefined) throw new Error(`vrm: no accessor ${accessorIndex}`)
  if (a.componentType !== FLOAT || a.type !== 'VEC3')
    throw new Error(`vrm: accessor ${accessorIndex} is not a float VEC3`)
  const out =
    a.bufferView === undefined
      ? new Float32Array(a.count * 3)
      : floats(g, a.bufferView, a.byteOffset ?? 0, a.count * 3)
  const s = a.sparse
  if (s !== undefined) {
    const iv = view(g, s.indices.bufferView)
    const start = g.bin.byteOffset + iv.at + (s.indices.byteOffset ?? 0)
    const raw = g.bin.buffer.slice(
      start,
      start +
        s.count *
          (s.indices.componentType === UNSIGNED_INT
            ? 4
            : s.indices.componentType === UNSIGNED_SHORT
            ? 2
            : 1)
    )
    const indices =
      s.indices.componentType === UNSIGNED_INT
        ? new Uint32Array(raw)
        : s.indices.componentType === UNSIGNED_SHORT
        ? new Uint16Array(raw)
        : s.indices.componentType === UNSIGNED_BYTE
        ? new Uint8Array(raw)
        : null
    if (indices === null)
      throw new Error(`vrm: accessor ${accessorIndex}: bad sparse indices`)
    const values = floats(
      g,
      s.values.bufferView,
      s.values.byteOffset ?? 0,
      s.count * 3
    )
    indices.forEach((v, k) => {
      out[v * 3] = values[k * 3]!
      out[v * 3 + 1] = values[k * 3 + 1]!
      out[v * 3 + 2] = values[k * 3 + 2]!
    })
  }
  return out
}
