// Cuts the site's starter clips out of UAL1_core.glb (Quaternius' Universal
// Animation Library, CC0, on the tosijs CDN): the mannequin, its skin and only
// the clips the creator and the demo play, channels and keys copied byte for
// byte. 6.3 MB becomes about 1.5 MB, which on a phone's slow 4G is some 24 s
// less before the character moves (#3654). The viewer's "more clips" still
// fetches the whole of UAL1_core.glb on request.
//
//   bun bin/make-ual-starter.ts [UAL1_core.glb]
//
// Without a path it reads the CDN's copy (cached in .cache/cdn/).

import {
  accessorBytes,
  BinBuilder,
  readGlb,
  writeGlb,
} from 'tosijs-3d/glb-chunks'
import { cachedFetch } from '../src/build/cdn'
import { STARTER_CLIPS, STARTER_SOURCE } from '../site/clips'

const path = process.argv[2]
const source = path
  ? new Uint8Array(await Bun.file(path).arrayBuffer())
  : new Uint8Array(await cachedFetch()(STARTER_SOURCE))
const ual = readGlb(source)
const j = structuredClone(ual.json)

const kept = STARTER_CLIPS.map((name) => {
  const a = j.animations.find((x: { name: string }) => x.name === name)
  if (!a) throw new Error(`no clip ${name} in UAL1_core.glb`)
  return a
})

// Every accessor still referenced, copied once into a fresh binary.
const bin = new BinBuilder()
const accessors: unknown[] = []
const moved = new Map<number, number>()
const copy = (index: number): number => {
  const done = moved.get(index)
  if (done !== undefined) return done
  const a = j.accessors[index]
  const view = bin.add(accessorBytes(ual, index))
  const { bufferView: _b, byteOffset: _o, ...rest } = a
  accessors.push({ ...rest, bufferView: view })
  moved.set(index, accessors.length - 1)
  return accessors.length - 1
}
for (const m of j.meshes ?? [])
  for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes))
      p.attributes[k] = copy(p.attributes[k])
    if (p.indices !== undefined) p.indices = copy(p.indices)
    for (const t of p.targets ?? [])
      for (const k of Object.keys(t)) t[k] = copy(t[k])
  }
for (const s of j.skins ?? [])
  if (s.inverseBindMatrices !== undefined)
    s.inverseBindMatrices = copy(s.inverseBindMatrices)
if (
  (j.images ?? []).some(
    (i: { bufferView?: number }) => i.bufferView !== undefined
  )
)
  throw new Error('UAL1_core.glb has embedded images: not handled')
const animations = kept.map(
  (a: { samplers: { input: number; output: number }[] }) => ({
    ...a,
    samplers: a.samplers.map((s) => ({
      ...s,
      input: copy(s.input),
      output: copy(s.output),
    })),
  })
)
const bytes = bin.bytes()
const out = {
  ...j,
  asset: {
    ...j.asset,
    generator: 'dramatis bin/make-ual-starter.ts',
    copyright:
      'Universal Animation Library by Quaternius, CC0 1.0 (https://quaternius.com)',
    extras: { source: STARTER_SOURCE, clips: STARTER_CLIPS },
  },
  animations,
  accessors,
  bufferViews: bin.views,
  buffers: [{ byteLength: bytes.byteLength }],
}
const target = new URL('../site/static/clips/ual-starter.glb', import.meta.url)
  .pathname
const glb = writeGlb(out, bytes)
await Bun.write(target, glb)
console.log(
  `wrote ${target}: ${animations.length} clips, ${(
    glb.byteLength /
    2 ** 20
  ).toFixed(2)} MB (from ${(source.byteLength / 2 ** 20).toFixed(2)} MB)`
)
