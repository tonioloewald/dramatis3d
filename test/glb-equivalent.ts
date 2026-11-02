/**
 * "Is this GLB the same export as that one?", in the sense that matters across platforms.
 *
 * JavaScriptCore takes Math.sin, Math.pow and friends from the platform's libm, so a build
 * on Linux and one on macOS can differ in the last float bits. That shifts how long the JSON's
 * min/max numbers print, so the files differ in length (CI run 41371765864: 4 to 8 bytes
 * smaller on ubuntu). Byte identity is therefore a same-machine property only. This compares:
 * - the glTF JSON structurally, with numbers equal within `tolerance`, ignoring only how the
 *   binary chunk is laid out (bufferViews, buffers, offsets, sparse packing);
 * - every accessor's values, element by element, within `tolerance`;
 * - every embedded image byte for byte, since nothing in an image depends on libm.
 * It returns the differences found, empty when the exports are equivalent.
 */
import {
  accessorValues,
  type Glb,
  type GltfJson,
  readGlb,
} from '../src/upstream/glb/glb-chunks'

/** About a tenth of a millimetre on positions, far below anything visible. */
export const GLB_TOLERANCE = 1e-4

const LAYOUT_KEYS = new Set(['bufferViews', 'buffers'])
const ACCESSOR_LAYOUT_KEYS = new Set(['bufferView', 'byteOffset', 'sparse'])

const close = (a: number, b: number, tolerance: number): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b))

function compareJson(
  a: unknown,
  b: unknown,
  path: string,
  tolerance: number,
  out: string[]
): void {
  if (out.length > 20) return
  if (typeof a === 'number' && typeof b === 'number') {
    if (!close(a, b, tolerance)) out.push(`${path}: ${a} vs ${b}`)
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path}: length ${a.length} vs ${b.length}`)
      return
    }
    a.forEach((v, i) => compareJson(v, b[i], `${path}[${i}]`, tolerance, out))
    return
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object'
  ) {
    const inAccessor = /\.accessors\[\d+\]$/.test(path)
    const inImage = /\.images\[\d+\]$/.test(path)
    const skip = (k: string): boolean =>
      (path === '$' && LAYOUT_KEYS.has(k)) ||
      (inAccessor && ACCESSOR_LAYOUT_KEYS.has(k)) ||
      (inImage && k === 'bufferView')
    const keys = new Set(
      [...Object.keys(a), ...Object.keys(b)].filter((k) => !skip(k))
    )
    for (const k of keys)
      compareJson(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
        tolerance,
        out
      )
    return
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)
}

function imageBytes(glb: Glb, image: GltfJson): Uint8Array {
  const view = glb.json.bufferViews[image.bufferView]
  if (glb.bin === null) throw new Error('image in a GLB with no binary chunk')
  return glb.bin.subarray(
    view.byteOffset ?? 0,
    (view.byteOffset ?? 0) + view.byteLength
  )
}

export function glbDifferences(
  aBytes: Uint8Array,
  bBytes: Uint8Array,
  tolerance = GLB_TOLERANCE
): string[] {
  const a = readGlb(aBytes)
  const b = readGlb(bBytes)
  const out: string[] = []
  compareJson(a.json, b.json, '$', tolerance, out)
  if (out.length > 0) return out
  const accessors: GltfJson[] = a.json.accessors ?? []
  accessors.forEach((_, i) => {
    if (out.length > 20) return
    const av = accessorValues(a, i)
    const bv = accessorValues(b, i)
    if (av.length !== bv.length) {
      out.push(`accessor ${i}: ${av.length} values vs ${bv.length}`)
      return
    }
    for (let k = 0; k < av.length; k++)
      if (!close(av[k]!, bv[k]!, tolerance)) {
        out.push(`accessor ${i} value ${k}: ${av[k]} vs ${bv[k]}`)
        return
      }
  })
  const images: GltfJson[] = a.json.images ?? []
  images.forEach((image, i) => {
    if (image.bufferView === undefined) return
    if (
      Buffer.compare(imageBytes(a, image), imageBytes(b, b.json.images[i])) !==
      0
    )
      out.push(`image ${i} (${image.name ?? image.mimeType}): bytes differ`)
  })
  return out
}
