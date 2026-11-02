// Spike 1, Blender as a second opinion: import every export with Blender's
// bundled glTF importer (background mode, factory settings) and check the
// armature, weights, shape keys and skinning, and play UAL's Walk_Loop
// (tools/engines/blender_check.py does the work inside Blender).
//
//   bun tools/engines/blender.ts [--json] [file.glb ...]
//
// BLENDER overrides the binary. Exits 1 when a check fails, 2 when Blender
// is missing or did not run.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type CharacterResult,
  exportsToCheck,
  profileExpectations,
  report,
  run,
  UAL_CLIP,
} from './common'
import { spliceClip } from './splice-clip'

const BLENDER =
  process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'

export interface BlenderRun {
  engine: 'blender'
  version: string
  ran: boolean
  characters: CharacterResult[]
  log: string[]
  error?: string
}

export async function runBlender(paths: string[] = []): Promise<BlenderRun> {
  const r: BlenderRun = {
    engine: 'blender',
    version: '',
    ran: false,
    characters: [],
    log: [],
  }
  if (!existsSync(BLENDER)) {
    r.error = `NOT RUN: no Blender at ${BLENDER} (set BLENDER)`
    return r
  }
  const exports = exportsToCheck(paths)
  if (exports.length === 0) {
    r.error = 'NOT RUN: no .glb in samples/out'
    return r
  }
  const dir = mkdtempSync(join(tmpdir(), 'dramatis-blender-'))
  const expect = join(dir, 'expect.json')
  const clip = new Uint8Array(readFileSync(UAL_CLIP))
  const walks = exports.map((e) =>
    join(dir, e.file.replace(/\.glb$/, '.walk.glb'))
  )
  for (const [i, e] of exports.entries())
    await Bun.write(
      walks[i]!,
      spliceClip(new Uint8Array(readFileSync(e.path)), clip)
    )
  const results = join(dir, 'results.json')
  await Bun.write(
    expect,
    JSON.stringify({
      ...profileExpectations(),
      clip: UAL_CLIP,
      characters: exports.map((e, i) => ({
        file: e.file,
        path: e.path,
        walkPath: walks[i],
        naming: e.naming,
        faceUnits: e.faceUnits,
      })),
    })
  )
  const out = await run([
    BLENDER,
    '--background',
    '--factory-startup',
    '--python-exit-code',
    '3',
    '--python',
    join(import.meta.dir, 'blender_check.py'),
    '--',
    expect,
    results,
  ])
  r.log = out.out
    .split('\n')
    .filter((l) => /error|warning|traceback/i.test(l))
    .slice(0, 40)
  if (!existsSync(results)) {
    r.error = `blender_check.py wrote no results (exit ${
      out.code
    }):\n${out.out.slice(-3000)}`
    rmSync(dir, { recursive: true, force: true })
    return r
  }
  const parsed = JSON.parse(await Bun.file(results).text())
  rmSync(dir, { recursive: true, force: true })
  r.version = parsed.blender
  r.characters = parsed.characters
  r.ran = true
  return r
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const r = await runBlender(args.filter((a) => a !== '--json'))
  if (json) console.log(JSON.stringify(r, null, 2))
  if (!r.ran) {
    console.error(r.error)
    process.exit(2)
  }
  if (!json && r.log.length > 0) {
    console.log('Blender log (errors and warnings):')
    for (const l of r.log) console.log(`  ${l}`)
  }
  const failed = json ? 0 : report(`Blender ${r.version}`, r.characters)
  const anyFail = r.characters.some((c) => c.checks.some((k) => !k.ok))
  process.exit(failed > 0 || anyFail ? 1 : 0)
}
