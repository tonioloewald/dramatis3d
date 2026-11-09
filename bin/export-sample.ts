// Writes samples/out/*.glb: contrasting characters exported to the profile,
// the input of gate 1 (`bun run gate1`). Each is written with its character
// file beside it (`<name>.character.json`), so it can be made again.
//
//   bun bin/export-sample.ts [name ...]
//
// Reads the hm08 pack from the CDN (cached in .cache/cdn/, so a second run is
// offline). Licences: the manifest's characterLicences (src/licences/), the
// same entries the public buildCharacter carries.
//
// MESH_SAMPLES are the AI cast (#3856): a mesh from the CDN, rigged from
// Tonio's hand-placed rig for it (tosijs-3d/character-sources, #3881),
// written by exportMeshGlb (src/mesh/). The rig goes into the character file
// as its recipe, so the sample is made again from the file alone.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { writeCharacter, type Character } from 'tosijs-3d/character-file'
import { loadHumanPack } from 'tosijs-3d/human-pack'
import type { NamingProfile } from '../src/contracts/profile'
import { buildCharacterWith } from '../src/build/build'
import { cachedFetch, HM08_PACK_URL } from '../src/build/cdn'
import { characterLicences } from '../src/contracts/licences'
import { writeCharacterGlb } from '../src/build/write'
import { setAssetBase } from 'tosijs-3d/asset-url'
import { AI_CHARACTER_SOURCES } from 'tosijs-3d/character-sources'
import { exportMeshGlb } from '../src/mesh'

interface Sample {
  /** Why it is here. */
  what: string
  character: Character
  naming?: NamingProfile
}

const character = (
  name: string,
  settings: Record<string, unknown>
): Character => ({ name, settings, cloth: {}, tailor: [], garments: {} })

export const SAMPLES: Record<string, Sample> = {
  'clothed-casual': {
    what: 'clothed: a man in a casual suit and shoes, short hair, brows',
    character: character('Clothed, casual', {
      gender: 1,
      age: 0.5,
      tone: 0.35,
      outfit: 'male_casualsuit02',
      shoes: 'shoes01',
      hair: 'short02',
      brows: 'eyebrow001',
    }),
  },
  'long-hair': {
    what: 'with hair: a woman with long hair, a sports suit, darker skin',
    character: character('Long hair', {
      gender: 0,
      age: 0.45,
      tone: 0.75,
      outfit: 'female_sportsuit01',
      shoes: 'shoes02',
      hair: 'long01',
      brows: 'eyebrow006',
    }),
  },
  'extreme-heavy': {
    what: 'a slider extreme: oldest, heaviest, most muscular, tallest, fair',
    character: character('Extreme, heavy', {
      gender: 1,
      age: 1,
      weight: 1,
      muscle: 1,
      height: 1,
      proportions: 1,
      tone: 0.05,
      outfit: 'male_worksuit01',
      shoes: 'shoes03',
      hair: 'afro01',
      brows: 'eyebrow010',
    }),
  },
  'clothed-casual-mixamo': {
    what: 'the first sample under the Mixamo naming profile',
    character: character('Clothed, casual (Mixamo)', {
      gender: 1,
      age: 0.5,
      tone: 0.35,
      outfit: 'male_casualsuit02',
      shoes: 'shoes01',
      hair: 'short02',
      brows: 'eyebrow001',
    }),
    naming: 'mixamo',
  },
}

/** The AI cast's meshes (CC0, cdn tonio/ai), by sample name. */
export const MESH_SAMPLES: Record<
  string,
  {
    what: string
    name: string
    /** Its key in tosijs-3d's AI_CHARACTER_SOURCES. */
    cast: string
    naming?: NamingProfile
  }
> = {
  'mesh-keisha': {
    what: 'a mesh body: Keisha (AI-made, CC0), in underwear',
    name: 'Keisha',
    cast: 'african-american-female',
  },
  'mesh-keisha-spacesuit': {
    what: 'a mesh body: Keisha in a spacesuit, under the Mixamo naming profile',
    name: 'Keisha (spacesuit)',
    cast: 'african-american-female-spacesuit',
    naming: 'mixamo',
  },
  'mesh-kevin': {
    what: 'a mesh body: Kevin (AI-made, CC0), in underwear',
    name: 'Kevin',
    cast: 'eurasian-male',
  },
  'mesh-kevin-spacesuit': {
    what: 'a mesh body: Kevin in a spacesuit',
    name: 'Kevin (spacesuit)',
    cast: 'eurasian-male-spacesuit',
  },
}

/** A mesh sample's character: the CDN mesh, and its hand-placed rig as the recipe. */
function meshCharacter(sample: (typeof MESH_SAMPLES)[string]): Character {
  setAssetBase('https://cdn.tosijs.net')
  const source = sample.cast
  const from = AI_CHARACTER_SOURCES[source]
  if (!from?.url) throw new Error(`${source}: not in tosijs-3d's cast`)
  if (!from.recipe?.binding?.markers)
    throw new Error(`${source}: tosijs-3d has no hand-placed rig for it`)
  return {
    name: sample.name,
    settings: { source, rigs: { [source]: structuredClone(from.recipe) } },
    cloth: {},
    tailor: [],
    garments: {},
    bodies: { [source]: { url: from.url } },
  }
}

const OUT = join(import.meta.dir, '..', 'samples', 'out')

if (import.meta.main) {
  const names = process.argv.slice(2)
  const chosen =
    names.length > 0
      ? names
      : [...Object.keys(SAMPLES), ...Object.keys(MESH_SAMPLES)]
  const fetcher = cachedFetch()
  const pack = await loadHumanPack(HM08_PACK_URL, fetcher)
  mkdirSync(OUT, { recursive: true })
  for (const name of chosen) {
    const mesh = MESH_SAMPLES[name]
    if (mesh !== undefined) {
      const t0 = performance.now()
      const c = meshCharacter(mesh)
      const bytes = await exportMeshGlb(c, {
        naming: mesh.naming ?? 'ue',
        fetch: fetcher,
      })
      await Bun.write(join(OUT, `${name}.glb`), bytes)
      await Bun.write(
        join(OUT, `${name}.character.json`),
        JSON.stringify(writeCharacter(c), null, 2) + '\n'
      )
      console.log(
        `${name}.glb: ${(bytes.byteLength / 1e6).toFixed(2)} MB, ${(
          (performance.now() - t0) /
          1000
        ).toFixed(1)} s — ${mesh.what}`
      )
      continue
    }
    const sample = SAMPLES[name]
    if (sample === undefined) throw new Error(`no sample ${name}`)
    const t0 = performance.now()
    const built = await buildCharacterWith(
      sample.character,
      pack,
      { fetch: fetcher },
      { licences: characterLicences }
    )
    const bytes = writeCharacterGlb(built, { naming: sample.naming ?? 'ue' })
    await Bun.write(join(OUT, `${name}.glb`), bytes)
    await Bun.write(
      join(OUT, `${name}.character.json`),
      JSON.stringify(writeCharacter(sample.character), null, 2) + '\n'
    )
    console.log(
      `${name}.glb: ${(bytes.byteLength / 1e6).toFixed(2)} MB, ${
        built.meshes.length
      } meshes (${built.meshes.map((m) => m.name).join(', ')}), ${
        built.faceUnits.length
      } face units, ${((performance.now() - t0) / 1000).toFixed(1)} s — ${
        sample.what
      }`
    )
  }
}
