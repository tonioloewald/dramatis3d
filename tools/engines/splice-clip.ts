// Splice a UAL clip into an export: the same GLB with one glTF animation
// added whose channels target the export's own joints, by name. For tools
// whose clip-to-skeleton path is awkward to script (Blender imports a
// skinless clip file as empties; Unity's glTFast builds clips per file), so
// they can play UAL's keys on the export's skeleton exactly as glTF states
// them. Nothing else in the file changes.
//
// The profile's rule for UAL clips holds: rotations on every joint,
// translations on `root` and `pelvis` only, the pelvis's scaled by the
// ratio of the hips' heights (site/docs/export-format.md, "Playing UAL
// clips").
//
//   bun tools/engines/splice-clip.ts <export.glb> <out.glb> [clip.glb]

import { readFileSync } from 'node:fs'
import {
  EXTRAS_KEY,
  jointName,
  type NamingProfile,
  UE_JOINT_NAMES,
} from '../../src/contracts/profile'
import {
  accessorBytes,
  readGlb,
  writeGlb,
} from '../../src/upstream/glb/glb-chunks'
import { UAL_CLIP } from './common'

const UE = new Set(UE_JOINT_NAMES)

/** The export's bytes with the clip's first animation spliced in. */
export function spliceClip(
  exportBytes: Uint8Array,
  clipBytes: Uint8Array
): Uint8Array {
  const target = readGlb(exportBytes)
  const clip = readGlb(clipBytes)
  const j = structuredClone(target.json)
  const naming: NamingProfile =
    j.asset?.extras?.[EXTRAS_KEY]?.naming === 'mixamo' ? 'mixamo' : 'ue'
  const anim = clip.json.animations?.[0]
  if (anim === undefined) throw new Error('the clip file has no animation')

  const nodeByName = new Map<string, number>(
    j.nodes.map((n: { name?: string }, i: number) => [n.name ?? '', i])
  )
  const pelvisOf = (
    json: { nodes: Array<{ name?: string; translation?: number[] }> },
    name: string
  ) => {
    const t = json.nodes.find((n) => n.name === name)?.translation ?? [0, 0, 0]
    return Math.hypot(t[0]!, t[1]!, t[2]!)
  }
  const ratio =
    pelvisOf(j, jointName('pelvis', naming)) / pelvisOf(clip.json, 'pelvis')

  // The new bytes go after the export's binary chunk, 4-byte aligned.
  const base = target.bin ?? new Uint8Array(0)
  const parts: Uint8Array[] = []
  let length = Math.ceil(base.byteLength / 4) * 4
  const start = length
  const copied = new Map<string, number>()
  const addAccessor = (index: number, scale = 1): number => {
    const key = `${index}:${scale}`
    const done = copied.get(key)
    if (done !== undefined) return done
    let bytes = accessorBytes(clip, index)
    if (scale !== 1) {
      const f = new Float32Array(bytes.slice().buffer)
      for (let i = 0; i < f.length; i++) f[i]! *= scale
      bytes = new Uint8Array(f.buffer)
    }
    const view = j.bufferViews.length
    j.bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: bytes.byteLength,
    })
    const padded = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4)
    padded.set(bytes)
    parts.push(padded)
    length += padded.byteLength
    const a = clip.json.accessors[index]
    const { bufferView: _v, byteOffset: _o, min, max, ...rest } = a
    const out: Record<string, unknown> = { ...rest, bufferView: view }
    // min/max are required on sampler inputs; a scaled output drops them.
    if (scale === 1 && min !== undefined) Object.assign(out, { min, max })
    j.accessors.push(out)
    copied.set(key, j.accessors.length - 1)
    return j.accessors.length - 1
  }

  const samplers: unknown[] = []
  const channels: unknown[] = []
  for (const ch of anim.channels as Array<{
    sampler: number
    target: { node: number; path: string }
  }>) {
    const ue = clip.json.nodes[ch.target.node]?.name as string | undefined
    if (ue === undefined || !UE.has(ue)) continue
    const path = ch.target.path
    const keep =
      path === 'rotation' ||
      (path === 'translation' && (ue === 'root' || ue === 'pelvis'))
    if (!keep) continue
    const node = nodeByName.get(jointName(ue, naming))
    if (node === undefined) continue
    const s = anim.samplers[ch.sampler]
    const scale = path === 'translation' && ue === 'pelvis' ? ratio : 1
    samplers.push({
      input: addAccessor(s.input),
      output: addAccessor(s.output, scale),
      interpolation: s.interpolation ?? 'LINEAR',
    })
    channels.push({ sampler: samplers.length - 1, target: { node, path } })
  }
  j.animations = [
    ...(j.animations ?? []),
    { name: anim.name, channels, samplers },
  ]

  const bin = new Uint8Array(length)
  bin.set(base, 0)
  let at = start
  for (const p of parts) {
    bin.set(p, at)
    at += p.byteLength
  }
  j.buffers = [{ ...(j.buffers?.[0] ?? {}), byteLength: bin.byteLength }]
  return writeGlb(j, bin)
}

if (import.meta.main) {
  const [input, output, clipPath = UAL_CLIP] = process.argv.slice(2)
  if (input === undefined || output === undefined) {
    console.error(
      'usage: bun tools/engines/splice-clip.ts <export.glb> <out.glb> [clip.glb]'
    )
    process.exit(1)
  }
  const out = spliceClip(
    new Uint8Array(readFileSync(input)),
    new Uint8Array(readFileSync(clipPath))
  )
  await Bun.write(output, out)
  console.log(`wrote ${output} (${out.byteLength} bytes)`)
}
