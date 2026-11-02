// Spike 1, Godot: import every export into samples/godot with Godot's own
// glTF importer (headless, default settings), then check the imported
// scenes and play UAL's Walk_Loop on each (samples/godot/scripts/check.gd).
//
//   bun tools/engines/godot.ts [--json] [--render <dir>] [file.glb ...]
//
// --render also renders one frame of each character walking into <dir>
// (the real renderer: it opens a window, so it needs a display).
//
// GODOT overrides the binary (default: the macOS app's). Exits 1 when a
// check fails, 2 when Godot is missing or did not run.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import {
  type CharacterResult,
  exportsToCheck,
  profileExpectations,
  REPO,
  report,
  run,
  tallyLog,
  UAL_CLIP,
} from './common'

const GODOT =
  process.env.GODOT ?? '/Applications/Godot.app/Contents/MacOS/Godot'
const PROJECT = join(REPO, 'samples/godot')

export interface GodotRun {
  engine: 'godot'
  version: string
  ran: boolean
  importLog: string[]
  characters: CharacterResult[]
  error?: string
}

export async function runGodot(paths: string[] = []): Promise<GodotRun> {
  const result: GodotRun = {
    engine: 'godot',
    version: '',
    ran: false,
    importLog: [],
    characters: [],
  }
  if (!existsSync(GODOT)) {
    result.error = `NOT RUN: no Godot at ${GODOT} (set GODOT)`
    return result
  }
  result.version = (await run([GODOT, '--version'])).out.trim()
  const exports = exportsToCheck(paths)
  if (exports.length === 0) {
    result.error = 'NOT RUN: no .glb in samples/out'
    return result
  }

  // A clean copy of the exports: stale ones (and their extracted textures) go.
  const chars = join(PROJECT, 'characters')
  for (const f of readdirSync(chars))
    if (f !== 'README.md') rmSync(join(chars, f))
  for (const e of exports) copyFileSync(e.path, join(chars, e.file))
  copyFileSync(UAL_CLIP, join(PROJECT, 'animations', basename(UAL_CLIP)))
  await Bun.write(
    join(PROJECT, 'expect.json'),
    JSON.stringify(
      {
        ...profileExpectations(),
        clip: 'res://animations/ual-walk.glb',
        characters: exports.map((e) => ({
          file: e.file,
          path: `res://characters/${e.file}`,
          naming: e.naming,
          faceUnits: e.faceUnits,
        })),
      },
      null,
      2
    )
  )
  rmSync(join(PROJECT, 'results.json'), { force: true })

  const imp = await run([GODOT, '--headless', '--path', PROJECT, '--import'])
  result.importLog = tallyLog(imp.out)
  const check = await run([
    GODOT,
    '--headless',
    '--path',
    PROJECT,
    '--script',
    'res://scripts/check.gd',
  ])
  const out = join(PROJECT, 'results.json')
  if (!existsSync(out)) {
    result.error = `check.gd wrote no results (exit ${
      check.code
    }):\n${check.out.slice(-3000)}`
    return result
  }
  const parsed = JSON.parse(await Bun.file(out).text())
  // Both are per run: leave nothing behind for git or prettier.
  rmSync(out, { force: true })
  rmSync(join(PROJECT, 'expect.json'), { force: true })
  result.ran = true
  result.characters = parsed.characters
  const scriptErrors = tallyLog(check.out)
  if (scriptErrors.length > 0)
    result.importLog.push(...scriptErrors.map((e) => `(check run) ${e}`))
  return result
}

/**
 * Render each imported character walking (Godot's movie writer, the real
 * renderer, a window opens) and keep one frame per character in `dir`.
 * Needs a display; run after runGodot so the imports exist.
 */
export async function renderGodot(dir: string): Promise<string[]> {
  dir = resolve(dir)
  const tmp = join(dir, '.frames')
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const written: string[] = []
  for (const f of readdirSync(join(PROJECT, 'characters'))) {
    if (!f.endsWith('.glb')) continue
    await run([
      GODOT,
      '--path',
      PROJECT,
      '--resolution',
      '480x720',
      '--fixed-fps',
      '30',
      '--write-movie',
      join(tmp, 'f.png'),
      '--quit-after',
      '21',
      '--',
      f,
    ])
    const frame = join(tmp, 'f00000020.png')
    if (!existsSync(frame)) continue
    const out = join(dir, `godot-${f.replace(/\.glb$/, '')}.png`)
    copyFileSync(frame, out)
    written.push(out)
    for (const g of readdirSync(tmp)) rmSync(join(tmp, g))
  }
  rmSync(tmp, { recursive: true, force: true })
  return written
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const renderAt = args.indexOf('--render')
  const renderDir = renderAt >= 0 ? args[renderAt + 1] : undefined
  const files = args.filter(
    (a, i) =>
      a !== '--json' &&
      a !== '--render' &&
      !(renderAt >= 0 && i === renderAt + 1)
  )
  const r = await runGodot(files)
  if (renderDir !== undefined && r.ran)
    for (const p of await renderGodot(renderDir)) console.log(`rendered ${p}`)
  if (json) console.log(JSON.stringify(r, null, 2))
  else {
    console.log(r.version)
    if (r.importLog.length > 0) {
      console.log('Godot log (errors and warnings, counted):')
      for (const l of r.importLog) console.log(`  ${l}`)
    }
  }
  if (!r.ran) {
    console.error(r.error)
    process.exit(2)
  }
  const failed = json ? 0 : report(`Godot ${r.version}`, r.characters)
  const anyFail = r.characters.some((c) => c.checks.some((k) => !k.ok))
  process.exit(failed > 0 || anyFail ? 1 : 0)
}
