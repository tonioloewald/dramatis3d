// The slider-extremes sweep (PLAN.md "No broken fits at the extremes").
//
//   bun bin/extremes.ts                 the full sweep (133 bodies)
//   bun bin/extremes.ts --quick         the default and 32 macro corners
//   bun bin/extremes.ts --pack <url|path to hm08.json> --hair <hairstyles.glb>
//   bun bin/extremes.ts --only <regex>  wear only the matching proxies
//   bun bin/extremes.ts --no-hair       skip Quaternius' hair
//   bun bin/extremes.ts --sheet         also draw reports/extremes-sheet.png
//   bun bin/extremes.ts --from reports/extremes.json   re-summarise a saved run
//
// Writes reports/extremes.md and reports/extremes.json. The pack and the
// hair library are read from ../static-assets when it is there (read only),
// else from the CDN. Garment licences are read from the MakeHuman asset
// packs' own pack JSONs (source/packs/*/packs/*.json, read only): a
// garment with no licence there is listed as unchecked.

import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs'
import { join } from 'path'
import { loadHumanPack } from 'tosijs-3d/human-pack'
import { sweepCorners } from '../src/upstream/extremes/corners'
import {
  runSweep,
  type ItemLicence,
  type SweepResult,
} from '../src/upstream/extremes/sweep'
import {
  readHairLibrary,
  referenceHeads,
  markLips,
} from '../src/upstream/extremes/hair-library'
import { summarise, renderMarkdown } from '../src/upstream/extremes/report'
import { contactSheet, sheetCases } from '../src/upstream/extremes/sheet'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const ROOT = join(import.meta.dir, '..')
// ../static-assets beside the repo (or beside a checkout this worktree is in).
const STATIC =
  option('--static') ??
  [1, 2, 3, 4, 5]
    .map((up) => join(ROOT, ...Array<string>(up).fill('..'), 'static-assets'))
    .find((d) => existsSync(join(d, 'assets/makehuman'))) ??
  join(ROOT, '..', 'static-assets')
const CDN = 'https://cdn.tosijs.net'
const LOCAL_PACK = join(STATIC, 'assets/makehuman/hm08/hm08.json')
const LOCAL_HAIR = join(STATIC, 'derived/quaternius/libraries/hairstyles.glb')
const PACKS_DIR = join(STATIC, 'assets/makehuman', 'source', 'packs')

const packUrl =
  option('--pack') ??
  (existsSync(LOCAL_PACK) ? LOCAL_PACK : `${CDN}/makehuman/hm08/hm08.json`)
const hairUrl =
  option('--hair') ??
  (existsSync(LOCAL_HAIR)
    ? LOCAL_HAIR
    : `${CDN}/quaternius/libraries/hairstyles.glb`)

const read = async (u: string): Promise<ArrayBuffer> => {
  if (/^https?:/.test(u)) {
    const r = await fetch(u)
    if (!r.ok) throw new Error(`${u}: ${r.status}`)
    return await r.arrayBuffer()
  }
  return await Bun.file(u).arrayBuffer()
}

// Licences from the MakeHuman asset packs' own metadata.
const licences: Record<string, ItemLicence> = {}
let licenceSource = 'not found'
if (existsSync(PACKS_DIR)) {
  licenceSource = 'MakeHuman asset pack metadata (source/packs/*/packs/*.json)'
  for (const pack of readdirSync(PACKS_DIR)) {
    const dir = join(PACKS_DIR, pack, 'packs')
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const meta = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<
        string,
        { license?: string; author?: string; source?: string }
      >
      for (const [name, m] of Object.entries(meta))
        if (m.license)
          licences[name] = {
            licence: m.license === 'CC0' ? 'CC0-1.0' : m.license,
            author: m.author ?? '',
            source: m.source ?? `MakeHuman asset pack ${pack}`,
          }
    }
  }
  // MakeHuman's system assets (the core clothes, hair, brows) carry their
  // CC0 release in each file's header, not a pack JSON.
  const system = join(PACKS_DIR, 'system')
  for (const kind of ['clothes', 'hair', 'eyebrows'])
    if (existsSync(join(system, kind)))
      for (const name of readdirSync(join(system, kind))) {
        const file = join(system, kind, name, `${name}.mhclo`)
        const proxy = join(system, kind, name, `${name}.proxy`)
        const f = existsSync(file) ? file : existsSync(proxy) ? proxy : null
        if (f && /released as CC0/.test(readFileSync(f, 'utf8').slice(0, 2000)))
          licences[name] ??= {
            licence: 'CC0-1.0',
            author:
              'MakeHuman (Data Collection AB, Joel Palmius, Jonas Hauquier)',
            source: 'MakeHuman system assets (makehuman_system_assets_cc0)',
          }
      }
}

console.log(`pack: ${packUrl}`)
const pack = await loadHumanPack(packUrl, read)
const only = option('--only')
const proxies = Object.entries(pack.manifest.proxies ?? {})
  .filter(([, p]) =>
    ['clothes', 'hair', 'eyebrows', 'beard'].includes(p.category)
  )
  .map(([n]) => n)
  .filter((n) => (only ? new RegExp(only).test(n) : true))

let hair: Parameters<typeof runSweep>[0]['hair']
if (!flag('--no-hair')) {
  console.log(`hair: ${hairUrl}`)
  const pieces = readHairLibrary(new Uint8Array(await read(hairUrl)))
  const heads = referenceHeads(pieces)
  markLips(pieces, heads)
  hair = {
    pieces: only
      ? pieces.filter(
          (p) =>
            new RegExp(only).test(p.name) || p.name.startsWith('Reference_')
        )
      : pieces,
    heads,
  }
}

// --from <json>: re-summarise a saved run (thresholds, report, sheet)
// without sweeping again.
const from = option('--from')
const started = Date.now()
let result: SweepResult
let minutes: number
if (from) {
  const saved = JSON.parse(readFileSync(from, 'utf8')) as {
    meta: { minutes: number }
    result: SweepResult
  }
  result = saved.result
  minutes = saved.meta.minutes
  console.log(`re-summarising ${from}`)
} else {
  const corners = sweepCorners({ quick: flag('--quick') })
  console.log(`${corners.length} bodies x ${proxies.length} proxies + hair`)
  result = await runSweep({
    pack,
    corners,
    proxies,
    hair,
    licences,
    onCorner(done, total, r) {
      console.log(
        `  ${done}/${total} ${r.corner.id} ${r.ms} ms, ${r.bones.length} bone issues`
      )
    },
  })
  minutes = +((Date.now() - started) / 60000).toFixed(1)
}
const summary = summarise(result)
const meta = {
  date: new Date().toLocaleDateString('en-CA'),
  pack: packUrl.startsWith(STATIC)
    ? 'static-assets/assets/makehuman/hm08/hm08.json'
    : packUrl,
  packSource: pack.manifest.source,
  hair: hair
    ? hairUrl.startsWith(STATIC)
      ? 'static-assets/derived/quaternius/libraries/hairstyles.glb'
      : hairUrl
    : null,
  licenceSource,
  quick: result.corners.length < sweepCorners().length,
  minutes,
  bun: Bun.version,
}
mkdirSync(join(ROOT, 'reports'), { recursive: true })
let sheet: { file: string; cases: ReturnType<typeof sheetCases> } | null = null
if (flag('--sheet')) {
  const png = await contactSheet(pack, result, summary, hair)
  sheet = { file: 'extremes-sheet.png', cases: sheetCases(summary) }
  writeFileSync(join(ROOT, 'reports', sheet.file), png)
}
writeFileSync(
  join(ROOT, 'reports/extremes.json'),
  JSON.stringify({ meta, summary, result })
)
// Formatted by the repo's prettier, so `bun run check` passes with it committed.
Bun.spawnSync(
  ['bun', '--bun', 'prettier', '--write', 'reports/extremes.json'],
  { cwd: ROOT }
)
writeFileSync(
  join(ROOT, 'reports/extremes.md'),
  renderMarkdown(meta, summary, result, sheet)
)
console.log(
  `wrote reports/extremes.md, reports/extremes.json${
    sheet ? `, reports/${sheet.file}` : ''
  } (${minutes} min)`
)
