// Cuts one clip out of Quaternius' Universal Animation Library (CC0) into
// test/gate1/fixtures/ual-walk.glb: UAL's armature (its 65 joints at their
// rest transforms, no mesh) and the `Walk_Loop` animation, channels and
// keys copied byte for byte. The harness plays it on every export.
//
//   bun test/gate1/make-ual-clip.ts <path to UAL1.glb> [clip]
//
// UAL1.glb is in static-assets (assets/quaternius/UAL1.glb), read-only.

import {
  accessorBytes,
  BinBuilder,
  readGlb,
  writeGlb,
} from '../../src/upstream/glb/glb-chunks'

const [source, clipName = 'Walk_Loop'] = process.argv.slice(2)
if (source === undefined) {
  console.error('usage: bun test/gate1/make-ual-clip.ts <UAL1.glb> [clip]')
  process.exit(1)
}
const ual = readGlb(new Uint8Array(await Bun.file(source).arrayBuffer()))
const j = ual.json
const clip = j.animations.find((a: { name: string }) => a.name === clipName)
if (clip === undefined) throw new Error(`no clip ${clipName} in ${source}`)

// Keep every node except meshes: the armature and its joints, by index.
const nodes = j.nodes.map((n: Record<string, unknown>) => {
  const { mesh: _mesh, skin: _skin, ...rest } = n
  return rest
})
const meshNodes = new Set<number>(
  j.nodes.flatMap((n: { mesh?: number }, i: number) =>
    n.mesh === undefined ? [] : [i]
  )
)
for (const n of nodes)
  if (Array.isArray(n.children))
    n.children = n.children.filter((c: number) => !meshNodes.has(c))

const bin = new BinBuilder()
const accessors: unknown[] = []
const copy = (index: number): number => {
  const a = j.accessors[index]
  const view = bin.add(accessorBytes(ual, index))
  const { bufferView: _b, byteOffset: _o, ...rest } = a
  accessors.push({ ...rest, bufferView: view })
  return accessors.length - 1
}
const samplers = clip.samplers.map(
  (s: { input: number; output: number; interpolation?: string }) => ({
    ...s,
    input: copy(s.input),
    output: copy(s.output),
  })
)
const bytes = bin.bytes()
const out = {
  asset: {
    version: '2.0',
    generator: 'dramatis test/gate1/make-ual-clip.ts',
    copyright:
      'Universal Animation Library by Quaternius, CC0 1.0 (https://quaternius.com)',
    extras: { source: 'UAL1.glb', clip: clipName },
  },
  scene: 0,
  scenes: [
    {
      name: 'Scene',
      nodes: j.scenes[j.scene ?? 0].nodes.filter(
        (n: number) => !meshNodes.has(n)
      ),
    },
  ],
  nodes,
  animations: [{ name: clip.name, channels: clip.channels, samplers }],
  accessors,
  bufferViews: bin.views,
  buffers: [{ byteLength: bytes.byteLength }],
}
const target = new URL('./fixtures/ual-walk.glb', import.meta.url).pathname
await Bun.write(target, writeGlb(out, bytes))
console.log(`wrote ${target}: ${clip.channels.length} channels`)
