import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { Character } from 'tosijs-3d/character-file'
import { glbRigTriangles } from 'tosijs-3d/glb-rig'
import { readGlb } from 'tosijs-3d/glb-chunks'
import { bodyFromMarkers } from 'tosijs-3d/rigged-body'
import type { HumanPack } from 'tosijs-3d/human-pack'
import { exportCharacterGlb, exportCharacterVrm } from '../contracts/export'
import { checkExportExtras } from '../contracts/profile'
import { vrmProblems } from '../vrm'
import { ualClips } from '../clips'
import {
  embeddedClipProblems,
  heldProblems,
  skeletonProblems,
} from '../../test/gate1/checks'
import { holdGrip } from 'tosijs-3d/hold-grip'
import { heldExtras, weaponAsset, type ExportHeld } from '../held'
import { heldParts, type RestJoint } from '../upstream/held-parts'
import { lookupLicence } from '../licences'
import { writeGlb } from 'tosijs-3d/glb-chunks'
import {
  AI_CAST_BASE,
  exportMeshGlb,
  hasMeshBody,
  MAKEHUMAN_SOURCE,
  meshLicence,
} from '.'

// A mesh of the user's, offline: one of the committed MakeHuman samples, read
// as any GLB is (glb-rig takes a skinned mesh at rest) and rigged from the
// markers the rig tool would start from. Its body alone (`pick`), to keep it quick.
const SAMPLE = join(
  import.meta.dir,
  '..',
  '..',
  'samples',
  'out',
  'long-hair.glb'
)
const bytes = async () => new Uint8Array(await Bun.file(SAMPLE).arrayBuffer())

// Guessed once: the guess binds the whole mesh (a second or more).
let guessed: Promise<{ b: Uint8Array; markers: any }> | undefined
const meshCharacter = async (
  over: Partial<Character> = {}
): Promise<Character> => {
  guessed ??= bytes().then((b) => {
    const made = bodyFromMarkers(glbRigTriangles(b, { pick: 'body' })).made
    if (made.by !== 'markers') throw new Error('not bound from markers')
    return { b, markers: made.markers }
  })
  const { b, markers } = await guessed
  const made = { markers }
  return {
    name: 'Hero',
    settings: {
      source: 'hero.glb',
      rigs: { 'hero.glb': { binding: { markers: made.markers } } },
    },
    cloth: {},
    tailor: [],
    garments: {},
    bodies: {
      'hero.glb': { file: { name: 'hero.glb', bytes: b }, pick: 'body' },
    },
    ...over,
  }
}
// The mesh path never reads the pack.
const NO_PACK = null as unknown as HumanPack

describe('mesh bodies', () => {
  test('a mesh body is any source but MakeHuman', () => {
    expect(hasMeshBody({ settings: {} })).toBe(false)
    expect(hasMeshBody({ settings: { source: MAKEHUMAN_SOURCE } })).toBe(false)
    expect(hasMeshBody({ settings: { source: 'hero.glb' } })).toBe(true)
  })

  test("the AI cast is CC0; a user's file says its licence isn't known", () => {
    const cast = meshLicence('Kevin', {
      url: `${AI_CAST_BASE}eurasian-male-10k.glb?v=2`,
    })
    expect(cast.licence).toBe('CC0-1.0')
    expect(cast.kind).toBe('base')
    expect(cast.source).toBe(`${AI_CAST_BASE}eurasian-male-10k.glb`)
    expect(cast.title).toContain('Meshy')
    const own = meshLicence('Hero', {
      file: { name: 'hero.glb', bytes: new Uint8Array() },
    })
    expect(own.licence).toBe('NOASSERTION')
    expect(own.source).toBe('user-supplied file: hero.glb')
    // A URL that isn't the cast's is no more known than a file.
    expect(meshLicence('X', { url: 'https://example.com/x.glb' }).licence).toBe(
      'NOASSERTION'
    )
  })

  test("a user's mesh exports as a profile GLB, with its licence entry", async () => {
    const glb = await exportCharacterGlb(await meshCharacter(), NO_PACK)
    const extras = readGlb(glb).json.asset.extras.dramatis
    expect(checkExportExtras(extras)).toEqual([])
    expect(extras.faceUnits).toEqual([])
    expect(extras.character).toBe('Hero')
    expect(extras.licences).toHaveLength(1)
    expect(extras.licences[0].asset).toBe('user:hero.glb')
    const json = readGlb(glb).json
    expect(json.skins[0].joints.length).toBeGreaterThanOrEqual(65)
  }, 30_000)

  test('Mixamo naming is passed through', async () => {
    const glb = await exportMeshGlb(await meshCharacter(), { naming: 'mixamo' })
    const json = readGlb(glb).json
    expect(json.asset.extras.dramatis.naming).toBe('mixamo')
    const names = json.skins[0].joints.map((i: number) => json.nodes[i].name)
    expect(names).toContain('mixamorig:Hips')
  }, 30_000)

  test('with clips (#3908), each licensed; gate 1 catches one that isn’t', async () => {
    const starter = new Uint8Array(
      await Bun.file(
        join(
          import.meta.dir,
          '..',
          '..',
          'site',
          'static',
          'clips',
          'ual-starter.glb'
        )
      ).arrayBuffer()
    )
    const glb = await exportMeshGlb(await meshCharacter(), {
      clips: ualClips(starter, ['Walk_Loop']),
    })
    const json = readGlb(glb).json
    expect(json.animations.map((a: { name: string }) => a.name)).toEqual([
      'Walk_Loop',
    ])
    expect(
      json.asset.extras.dramatis.licences.map((l: { asset: string }) => l.asset)
    ).toEqual(['user:hero.glb', 'quaternius:animation/ual1'])
    expect(await embeddedClipProblems(glb)).toEqual([])
    const broken = readGlb(glb)
    broken.json.asset.extras.dramatis.licences.pop()
    expect(
      (await embeddedClipProblems(writeGlb(broken.json, broken.bin))).join()
    ).toContain('is not among the file')
  }, 60_000)

  test('held (#3909): weapon_r under the hand; held-parts puts it where riggedBodyGlb does', async () => {
    // A stand-in pistol (the library is on the CDN): a 4 × 15 × 4 cm box,
    // its grip at the origin.
    const box: number[] = []
    for (const x of [-0.02, 0.02])
      for (const y of [0, 0.15])
        for (const z of [-0.02, 0.02]) box.push(x, y, z)
    const quads = [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ]
    const held: ExportHeld = {
      name: 'Pistol',
      grip: holdGrip('Pistol'),
      item: {
        positions: box,
        indices: quads.flatMap(([a, b, c, d]) => [a!, b!, c!, a!, c!, d!]),
      },
      gripPoint: { x: 0, y: 0, z: 0 },
      licence: lookupLicence(weaponAsset('Pistol'))!,
    }
    expect(held.licence.licence).toBe('CC0-1.0')
    const glb = await exportMeshGlb(await meshCharacter(), { held })
    const file = readGlb(glb)
    expect(skeletonProblems(file)).toEqual([])
    expect(heldProblems(file)).toEqual([])
    const json = file.json
    expect(
      json.asset.extras.dramatis.licences.map((l: { asset: string }) => l.asset)
    ).toEqual(['user:hero.glb', 'tonio:weapon/pistol'])
    // The file's own 65 joints at rest, in model space.
    const ids: number[] = json.skins[0].joints
    const parentOf = new Map<number, number>()
    json.nodes.forEach((n: any, i: number) =>
      n.children?.forEach((c: number) => parentOf.set(c, i))
    )
    const joints: RestJoint[] = []
    const world: Array<{ p: number[]; q: number[] }> = []
    const qm = (a: number[], b: number[]) => [
      a[3]! * b[0]! + a[0]! * b[3]! + a[1]! * b[2]! - a[2]! * b[1]!,
      a[3]! * b[1]! - a[0]! * b[2]! + a[1]! * b[3]! + a[2]! * b[0]!,
      a[3]! * b[2]! + a[0]! * b[1]! - a[1]! * b[0]! + a[2]! * b[3]!,
      a[3]! * b[3]! - a[0]! * b[0]! - a[1]! * b[1]! - a[2]! * b[2]!,
    ]
    const qr = (q: number[], v: number[]) => {
      const p = qm(qm(q, [...v, 0]), [-q[0]!, -q[1]!, -q[2]!, q[3]!])
      return p.slice(0, 3)
    }
    ids.slice(0, -1).forEach((id, i) => {
      const n = json.nodes[id]
      const parent = ids.indexOf(parentOf.get(id) ?? -1)
      const t: number[] = n.translation ?? [0, 0, 0]
      const r: number[] = n.rotation ?? [0, 0, 0, 1]
      const w =
        parent < 0
          ? { p: t, q: r }
          : {
              p: qr(world[parent]!.q, t).map(
                (v, k) => v + world[parent]!.p[k]!
              ),
              q: qm(world[parent]!.q, r),
            }
      world.push(w)
      joints.push({
        name: n.name,
        parent,
        translation: t as [number, number, number],
        rotation: r as [number, number, number, number],
        position: w.p as [number, number, number],
      })
    })
    const parts = heldParts(
      joints,
      {
        grip: held.grip,
        item: held.item,
        gripPoint: held.gripPoint!,
        extras: heldExtras(held),
      },
      { materialBase: 0, imageBase: 0 }
    )
    const socket = json.nodes[ids[ids.length - 1]!]
    expect(socket.name).toBe('weapon_r')
    expect(parts.joint.name).toBe('weapon_r')
    expect(joints[parts.joint.parent]!.name).toBe('hand_r')
    parts.joint.translation.forEach((v, k) =>
      expect(v).toBeCloseTo(socket.translation[k], 4)
    )
    // The same turn (q and -q are one turn).
    const dot = parts.joint.rotation.reduce(
      (s, v, k) => s + v * socket.rotation[k],
      0
    )
    expect(Math.abs(dot)).toBeCloseTo(1, 4)
    expect(parts.mesh?.extras).toEqual({
      dramatis: { licence: 'tonio:weapon/pistol' },
    })
  }, 30_000)

  test('and as VRM 1.0', async () => {
    const vrm = await exportCharacterVrm(await meshCharacter(), NO_PACK)
    expect(vrmProblems(vrm)).toEqual([])
  }, 30_000)

  test('says what is missing: the mesh, or the rig', async () => {
    const c = await meshCharacter()
    await expect(exportMeshGlb({ ...c, bodies: {} })).rejects.toThrow(
      /doesn't say where the mesh is/
    )
    await expect(
      exportMeshGlb({ ...c, settings: { ...c.settings, rigs: {} } })
    ).rejects.toThrow(/isn't rigged yet/)
  }, 30_000)
})
