// A look at an export without a GPU: three's GLTFLoader loads it, its skinned
// meshes are posed on the CPU (at rest, or at a moment of UAL's Walk_Loop,
// played as the gate plays it), and a small rasteriser draws them flat-shaded
// to a PNG, front or side, with the floor in red. A development tool, for
// checking the rest pose and a clip by eye; not reachable from any entry.
//
//   bun src/build/preview.ts <export.glb> <out.png> [walk time 0..1] [front|side]

import { deflateSync } from 'node:zlib'
import { AnimationMixer, SkinnedMesh, Vector3 } from 'three'
import {
  clipOnExport,
  declaredNaming,
  loadWithThree,
} from '../../test/gate1/checks'
import { clipBytes } from '../../test/gate1/fixture'
import { readGlb } from '../upstream/glb/glb-chunks'

const W = 600
const H = 700

/** The PNG of an export, posed at `walk` (0..1 of Walk_Loop) or at rest. */
export async function preview(
  bytes: Uint8Array,
  options: { walk?: number; view?: 'front' | 'side' } = {}
): Promise<Uint8Array> {
  const scene = (await loadWithThree(bytes)).scene
  if (options.walk !== undefined) {
    const source = await loadWithThree(await clipBytes())
    const clip = clipOnExport(
      source.animations[0]!,
      scene,
      source.scene,
      declaredNaming(readGlb(bytes))
    )
    const mixer = new AnimationMixer(scene)
    mixer.clipAction(clip).play()
    mixer.setTime(clip.duration * options.walk)
  }
  scene.updateMatrixWorld(true)
  const side = options.view === 'side'
  const img = new Uint8Array(W * H * 3).fill(255)
  const depth = new Float32Array(W * H).fill(-Infinity)
  const scale = 330
  const cx = W / 2
  const cy = H - 40
  const project = (v: Vector3): [number, number, number] =>
    side
      ? [cx + v.z * scale, cy - v.y * scale, v.x]
      : [cx + v.x * scale, cy - v.y * scale, v.z]
  const colour = (name: string): [number, number, number] =>
    name === 'body'
      ? [230, 180, 150]
      : name === 'hair'
      ? [90, 60, 40]
      : name === 'eyes'
      ? [250, 250, 250]
      : name.startsWith('garment_')
      ? [80, 110, 170]
      : [150, 150, 150]
  scene.traverse((o) => {
    if (!(o instanceof SkinnedMesh)) return
    o.skeleton.update()
    const pos = o.geometry.getAttribute('position')
    const index = o.geometry.getIndex()
    if (index === null) return
    const at: Vector3[] = []
    for (let i = 0; i < pos.count; i++) {
      const v = new Vector3().fromBufferAttribute(pos, i)
      o.applyBoneTransform(i, v)
      at.push(v.applyMatrix4(o.matrixWorld))
    }
    const base = colour(o.name)
    for (let k = 0; k < index.count; k += 3) {
      const a = at[index.getX(k)]!
      const b = at[index.getX(k + 1)]!
      const c = at[index.getX(k + 2)]!
      const n = new Vector3()
        .subVectors(b, a)
        .cross(new Vector3().subVectors(c, a))
        .normalize()
      const light = Math.max(
        0.15,
        Math.abs(
          side ? 0.3 * n.x + 0.3 * n.y + 0.9 * n.z : 0.9 * n.z + 0.3 * n.y
        )
      )
      const [ax, ay, az] = project(a)
      const [bx, by, bz] = project(b)
      const [qx, qy, qz] = project(c)
      const area = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax)
      if (Math.abs(area) < 1e-9) continue
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx)))
      const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx)))
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, qy)))
      const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, qy)))
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const w0 = ((bx - x) * (qy - y) - (by - y) * (qx - x)) / area
          const w1 = ((qx - x) * (ay - y) - (qy - y) * (ax - x)) / area
          const w2 = 1 - w0 - w1
          if (w0 < 0 || w1 < 0 || w2 < 0) continue
          const z = w0 * az + w1 * bz + w2 * qz
          if (z <= depth[y * W + x]!) continue
          depth[y * W + x] = z
          for (let ch = 0; ch < 3; ch++)
            img[(y * W + x) * 3 + ch] = Math.min(255, base[ch]! * light)
        }
    }
  })
  for (let x = 0; x < W; x++) img.set([255, 0, 0], (cy * W + x) * 3)
  return png(img)
}

function png(rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array((W * 3 + 1) * H)
  for (let y = 0; y < H; y++)
    raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1)
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Uint8Array): number => {
    let c = 0xffffffff
    for (const x of b) c = table[(c ^ x) & 255]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)))
    return out
  }
  const ihdr = new Uint8Array(13)
  new DataView(ihdr.buffer).setUint32(0, W)
  new DataView(ihdr.buffer).setUint32(4, H)
  ihdr[8] = 8
  ihdr[9] = 2
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

if (import.meta.main) {
  const [input, output, walk, view] = process.argv.slice(2)
  if (input === undefined || output === undefined) {
    console.error(
      'usage: bun src/build/preview.ts <export.glb> <out.png> [walk 0..1] [front|side]'
    )
    process.exit(1)
  }
  const bytes = new Uint8Array(await Bun.file(input).arrayBuffer())
  await Bun.write(
    output,
    await preview(bytes, {
      ...(walk !== undefined && walk !== '' ? { walk: Number(walk) } : {}),
      view: view === 'side' ? 'side' : 'front',
    })
  )
}
