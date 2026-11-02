// THE SEAMS: where one lane's output is another lane's input, checked on a
// real built character (not a lane's own fixture). Network tier, like
// src/build/build.network.test.ts: it reads the hm08 pack from the CDN
// (cached in .cache/cdn/), so it is off by default; run it with
//
//   DRAMATIS_NETWORK=1 bun test test/fit
//
// Without the variable each test is registered as skipped under a name
// starting NOT RUN, so the summary says so.
//
//   creator -> exporter      the creator's character file exports and passes gate 1
//   exporter -> licences     the GLB carries exactly characterLicences' entries
//   share -> exporter        a share link round trip exports the same bytes
//   exporter -> handoff      the creator's handoff record holds the GLB and its licences
//   exporter -> three        characterObject(built) is GLTFLoader's scene of its GLB,
//                            and a UAL clip plays on it
//   creator -> licences      a community asset is refused with a sentence, not a crash

import { describe, expect, test } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import {
  AnimationMixer,
  PropertyBinding,
  SkinnedMesh,
  Vector3,
  type AnimationClip,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Character } from 'tosijs-3d/character-file'
import { HAIR_COLOURS } from 'tosijs-3d/hair-shading'
import { type HumanPack, loadHumanPack } from 'tosijs-3d/human-pack'
import {
  buildCharacter,
  characterLicences,
  decodeShareLink,
  encodeShareLink,
  exportCharacterGlb,
  jointName,
  writeCharacterGlb,
} from '../../src/contracts'
import { putHandoff, takeHandoff } from '../../src/contracts/handoff'
import { cachedFetch, HM08_PACK_URL } from '../../src/build/cdn'
import { BUILD_SETTINGS } from '../../src/build/settings'
import { characterClip, characterObject } from '../../src/three'
import {
  exportGlb,
  glbLicences,
  licensedChoice,
} from '../../site/creator/actions'
import {
  clipProblems,
  licenceProblems,
  morphProblems,
  skeletonProblems,
  validatorErrors,
} from '../gate1/checks'
import { clipBytes } from '../gate1/fixture'
import { readGlb } from 'tosijs-3d/glb-chunks'

const ON = process.env.DRAMATIS_NETWORK === '1'
const it = (name: string, fn: () => Promise<void>, timeout = 180_000): void =>
  ON
    ? test(name, fn, timeout)
    : test.skip(`NOT RUN (set DRAMATIS_NETWORK=1): ${name}`, fn, timeout)

const fetcher = cachedFetch()
let packPromise: Promise<HumanPack> | null = null
const pack = (): Promise<HumanPack> =>
  (packPromise ??= loadHumanPack(HM08_PACK_URL, fetcher))

// The creator's character file, as site/creator/app.ts snapshots it:
// tosijs-3d's DEFAULT_CHARACTER keys minus hideClothes, rigs, surfaces and
// source (restated here: tosijs-3d/character imports Babylon), no tailor,
// no garments of its own.
const CREATOR_EXTRAS = {
  iris: 0.2,
  irisColour: '#5a3519',
  hairBase: HAIR_COLOURS.brown!.base,
  hairHighlight: HAIR_COLOURS.brown!.highlight,
  hairUp: 0,
  hairForward: 0,
  hairSize: 1,
  stubble: 0,
  blink: true,
  talk: false,
  smile: 0,
  browsUp: 0,
  frown: 0,
}
const creatorCharacter = (
  name: string,
  settings: Record<string, unknown> = {}
): Character => {
  const { source: _source, ...kept } = BUILD_SETTINGS as Record<string, unknown>
  void _source
  return {
    name,
    settings: { ...kept, ...CREATOR_EXTRAS, ...settings },
    cloth: {},
    tailor: [],
    garments: {},
  }
}

async function walkClip(): Promise<AnimationClip> {
  const bytes = await clipBytes()
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer,
    ''
  )
  const clip = gltf.animations.find((a) => a.name === 'Walk_Loop')
  if (clip === undefined) throw new Error('no Walk_Loop in the gate fixture')
  return clip
}

const arrayBuffer = (b: Uint8Array): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

describe('the seams between lanes', () => {
  it("creator -> exporter -> licences: the creator's default character exports, passes gate 1, and carries characterLicences", async () => {
    const p = await pack()
    const character = creatorCharacter('Creator default')
    const glb = await exportCharacterGlb(character, p, {
      naming: 'ue',
      fetch: fetcher,
    })
    expect(await validatorErrors(glb)).toEqual([])
    const read = readGlb(glb)
    expect(skeletonProblems(read)).toEqual([])
    expect(morphProblems(read)).toEqual([])
    expect(licenceProblems(read)).toEqual([])
    expect(await clipProblems(glb, await clipBytes())).toEqual([])
    expect(glbLicences(glb)).toEqual(characterLicences(character, p))
  })

  it('share -> exporter: a share link round trip exports the same bytes', async () => {
    const p = await pack()
    const character = creatorCharacter('Shared', {
      gender: 0,
      weight: 0.8,
      outfit: 'female_casualsuit01',
      hair: 'bob01',
    })
    const link = encodeShareLink(character, {
      base: 'https://dramatis.tosijs.net/creator/',
    })
    expect(link.dropped).toEqual([])
    const { character: back } = decodeShareLink(link.url, {
      settings: { ...BUILD_SETTINGS, ...CREATOR_EXTRAS },
    })
    const a = await exportCharacterGlb(character, p, { fetch: fetcher })
    const b = await exportCharacterGlb(back, p, { fetch: fetcher })
    expect(b.byteLength).toBe(a.byteLength)
    expect(Buffer.compare(a, b)).toBe(0)
  })

  it("exporter -> handoff: the creator's handoff record holds the GLB and its licences", async () => {
    const p = await pack()
    const glb = await exportCharacterGlb(creatorCharacter('Handed'), p, {
      fetch: fetcher,
    })
    const indexedDB = new IDBFactory()
    const id = await putHandoff(
      {
        glb,
        fileName: 'Handed.glb',
        character: 'Handed',
        licences: glbLicences(glb),
      },
      { indexedDB }
    )
    const got = await takeHandoff(id, { indexedDB })
    expect(got).not.toBeNull()
    expect(Buffer.compare(got!.glb, glb)).toBe(0)
    expect(got!.licences).toEqual(glbLicences(glb))
    expect(got!.licences.length).toBeGreaterThan(0)
  })

  for (const naming of ['ue', 'mixamo'] as const)
    it(`exporter -> three (${naming}): characterObject(built) is GLTFLoader's scene of writeCharacterGlb(built), and Walk_Loop plays`, async () => {
      const p = await pack()
      const built = await buildCharacter(creatorCharacter('Three'), p, {
        fetch: fetcher,
      })
      const glb = writeCharacterGlb(built, { naming })
      const gltf = await new GLTFLoader().parseAsync(arrayBuffer(glb), '')
      const loaded: SkinnedMesh[] = []
      gltf.scene.traverse((o) => {
        if (o instanceof SkinnedMesh) loaded.push(o)
      })
      const c = characterObject(built, { naming })
      expect(loaded.map((m) => m.name)).toEqual(c.meshes.map((m) => m.name))
      expect(loaded[0]!.skeleton.bones.map((b) => b.name)).toEqual(
        c.skeleton.bones.map((b) => b.name)
      )
      loaded.forEach((m, i) => {
        const ours = c.meshes[i]!
        expect(Object.keys(m.morphTargetDictionary ?? {})).toEqual(
          Object.keys(ours.morphTargetDictionary ?? {})
        )
        expect(m.geometry.getAttribute('position').count).toBe(
          ours.geometry.getAttribute('position').count
        )
        expect((m.material as { type: string }).type).toBe(
          (ours.material as { type: string }).type
        )
      })
      // Rest bones in the same places.
      gltf.scene.updateMatrixWorld(true)
      c.root.updateMatrixWorld(true)
      const theirs = loaded[0]!.skeleton.bones
      c.skeleton.bones.forEach((bone, i) => {
        const d = bone
          .getWorldPosition(new Vector3())
          .distanceTo(theirs[i]!.getWorldPosition(new Vector3()))
        expect(d).toBeLessThan(1e-5)
      })
      // A UAL clip plays on it and moves the hand.
      const clip = characterClip(await walkClip(), { naming })
      const mixer = new AnimationMixer(c.root)
      mixer.clipAction(clip).play()
      const hand = c.skeleton.bones.find(
        (b) =>
          b.name ===
          PropertyBinding.sanitizeNodeName(jointName('hand_l', naming))
      )!
      const at = (t: number) => {
        mixer.setTime(t)
        c.root.updateMatrixWorld(true)
        return hand.getWorldPosition(new Vector3())
      }
      expect(at(0).distanceTo(at(clip.duration / 2))).toBeGreaterThan(0.05)
      c.dispose()
    })

  it('creator -> licences: the creator offers only what the manifest licenses', async () => {
    const p = await pack()
    expect(licensedChoice('outfit', 'none', p)).toBe(true)
    expect(licensedChoice('outfit', 'male_casualsuit02', p)).toBe(true)
    expect(licensedChoice('shoes', 'shoes01', p)).toBe(true)
    expect(licensedChoice('hair', 'short02', p)).toBe(true)
    expect(licensedChoice('bottom', 'toigo_harem_pants', p)).toBe(false)
    // Every pack proxy the creator would offer exports, licence-wise.
    for (const [name, proxy] of Object.entries(p.manifest.proxies ?? {})) {
      const slot = (proxy as { slot?: string }).slot
      if (slot === undefined || !licensedChoice(slot, name, p)) continue
      expect(() =>
        characterLicences(
          creatorCharacter(name, { outfit: 'none', [slot]: name }),
          p
        )
      ).not.toThrow()
    }
  })

  it('creator -> licences: a community asset is refused with a sentence that names it', async () => {
    const p = await pack()
    const out = await exportGlb({
      character: creatorCharacter('Community', {
        outfit: 'none',
        bottom: 'toigo_harem_pants',
      }),
      pack: p,
      naming: 'ue',
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.message).toContain('toigo_harem_pants')
  })
})
