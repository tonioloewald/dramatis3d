#!/usr/bin/env bun
/*
SCAN THE PACKS the creator uses and write what they reference to
src/licences/packs.ts, the snapshot the licence manifest is checked
against (licences.test.ts).

  bun src/licences/scan-packs.ts [path/to/static-assets]

It READS a static-assets checkout (default: STATIC_ASSETS, else
../static-assets beside the repo) and writes only the snapshot. What it reads:

- makehuman/hm08/hm08.json: the pack tosijs-3d's character loads (its proxies,
  their looks, its parts). Every name in it is an asset the creator can show.
- makehuman/source/packs/<pack>/packs/<pack>.json: MakeHuman's own per-asset
  metadata for each asset pack the converter unpacked (author, licence as
  DECLARED by the pack, the asset's page). It is recorded as declared, not as
  checked: a person checks each community asset (PLAN.md).
- makehuman/source/packs/<pack>/clothes/<name>/: which pack each proxy came
  from, and the original material id behind each look.
- quaternius/hairstyles/: the hair library's pieces (tosijs-3d's human-hair
  names a piece by its node name, the file's stem).

Nothing here is MakeHuman code: it reads their JSON and directory layout.
*/

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO = join(import.meta.dir, '..', '..')
const STATIC =
  process.argv[2] ??
  process.env.STATIC_ASSETS ??
  join(REPO, '..', 'static-assets')
const ASSETS = join(STATIC, 'assets')
const MH = join(ASSETS, 'makehuman')
const PACKS = join(MH, 'source', 'packs')
const OUT = join(import.meta.dir, 'packs.ts')

if (!existsSync(join(MH, 'hm08', 'hm08.json')))
  throw new Error(`no static-assets checkout at ${STATIC}`)

interface Declared {
  author: string
  license: string
  source: string
  created: string
  original_author: string
  original_source: string
}

const manifestText = readFileSync(join(MH, 'hm08', 'hm08.json'), 'utf8')
const manifest = JSON.parse(manifestText) as {
  source: { repo: string; commit: string }
  license: string
  parts?: Record<string, unknown>
  proxies?: Record<
    string,
    {
      category: string
      slot?: string
      material: { looks?: Record<string, unknown> }
    }
  >
}

// The asset packs on disk, and each one's declared metadata.
const packDirs = readdirSync(PACKS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
const declared: Record<string, Record<string, Declared>> = {}
for (const pack of packDirs) {
  const dir = join(PACKS, pack, 'packs')
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')))
    declared[pack] = {
      ...declared[pack],
      ...(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<
        string,
        Declared
      >),
    }
}
/** Where each pack's zip came from (the converter's URLs). */
const PACK_ZIP: Record<string, string> = {
  system:
    'https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip',
  clothes_materials01:
    'https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip',
}
/** The declared fields worth keeping (the descriptions are long and not licence data). */
const pick = (d: Declared | undefined) =>
  d == null
    ? null
    : {
        author: d.author,
        license: d.license,
        source: d.source,
        ...(d.original_author ? { original_author: d.original_author } : {}),
        ...(d.original_source ? { original_source: d.original_source } : {}),
      }
const zipOf = (pack: string) =>
  PACK_ZIP[pack] ??
  `https://files.makehumancommunity.org/asset_packs/${pack}/${pack}_cc0.zip`

/** The pack a proxy was unpacked from. */
function packOf(name: string, category: string): string {
  const systemDir = category === 'beard' ? null : join(PACKS, 'system')
  if (systemDir) {
    for (const sub of readdirSync(systemDir))
      if (existsSync(join(systemDir, sub, name))) return 'system'
  }
  for (const pack of packDirs)
    if (pack !== 'system' && existsSync(join(PACKS, pack, 'clothes', name)))
      return pack
  throw new Error(`proxy ${name}: not found in any unpacked pack`)
}

/** The converter's look name for a material id (static-assets' rule). */
const lookName = (id: string) =>
  id.replace(/^toigo_male_(elegant|casual)_suit(_\d+)?_/, '').replace(/_/g, ' ')

const proxies: Record<string, unknown> = {}
for (const [name, p] of Object.entries(manifest.proxies ?? {}).sort(
  ([a], [b]) => (a < b ? -1 : 1)
)) {
  const pack = packOf(name, p.category)
  const looks: Record<string, unknown> = {}
  for (const look of Object.keys(p.material.looks ?? {})) {
    const dir = join(PACKS, 'clothes_materials01', 'clothes', name)
    const id = existsSync(dir)
      ? readdirSync(dir).find((d) => lookName(d) === look)
      : undefined
    if (id == null) throw new Error(`look ${name}/${look}: no material found`)
    looks[look] = {
      pack: 'clothes_materials01',
      material: id,
      declared: pick(declared.clothes_materials01?.[id]),
    }
  }
  proxies[name] = {
    category: p.category,
    ...(p.slot ? { slot: p.slot } : {}),
    pack,
    declared: pick(declared[pack]?.[name]),
    ...(Object.keys(looks).length ? { looks } : {}),
  }
}

const hairDir = join(ASSETS, 'quaternius', 'hairstyles')
const hairFiles = readdirSync(hairDir).sort()
const hair = hairFiles
  .filter((f) => f.endsWith('.gltf'))
  .map((f) => f.replace(/\.gltf$/, ''))
const hairTextures = hairFiles.filter((f) => /\.(png|jpe?g)$/.test(f))

const snapshot = {
  pack: {
    path: 'makehuman/hm08/hm08.json',
    sha256: createHash('sha256').update(manifestText).digest('hex'),
    source: manifest.source,
    license: manifest.license,
    parts: Object.keys(manifest.parts ?? {}).sort(),
  },
  packZips: Object.fromEntries(
    [
      ...new Set(
        Object.values(proxies).map((p) => (p as { pack: string }).pack)
      ),
      'clothes_materials01',
    ]
      .sort()
      .map((p) => [p, zipOf(p)])
  ),
  proxies,
  quaternius: {
    path: 'quaternius/libraries/hairstyles.glb',
    pieces: hair,
    textures: hairTextures,
  },
}

writeFileSync(
  OUT,
  `// Written by src/licences/scan-packs.ts from a static-assets checkout. Do not edit.\n\n` +
    `/** What the creator's packs reference (the snapshot the manifest is checked against). */\n` +
    `export const PACKS = ${JSON.stringify(snapshot, null, 2)} as const\n`
)
// The repo's formatter has the last word on layout.
Bun.spawnSync(['bun', '--bun', 'prettier', '--write', OUT], { cwd: REPO })
console.log(
  `wrote ${OUT}: ${Object.keys(proxies).length} proxies, ${
    hair.length
  } hair pieces`
)
