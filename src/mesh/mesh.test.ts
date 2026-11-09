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
import { embeddedClipProblems } from '../../test/gate1/checks'
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
