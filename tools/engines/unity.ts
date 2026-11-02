// Spike 1, Unity: prepare samples/unity (copy every export into
// Assets/Characters/ with a ".walk.glb" twin carrying UAL's Walk_Loop on
// its own joints) and run the batch-mode check if a Unity editor is
// installed; otherwise print the exact command and report NOT RUN.
//
//   bun tools/engines/unity.ts [--prepare-only] [file.glb ...]
//   bun tools/engines/unity.ts --web      build the Web player for /unity/
//
// --web needs the editor's Web build support. It builds samples/unity for the
// Web (Dramatis.WebBuild.Build) and copies Build/ into site/unity/player/,
// which the site ships; commit it.
//
// UNITY overrides the editor binary; by default the newest editor under
// /Applications/Unity/Hub/Editor/ is used. Exits 1 when a check fails, 2
// when Unity did not run.

import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  type CharacterResult,
  exportsToCheck,
  REPO,
  report,
  run,
  UAL_CLIP,
} from './common'
import { spliceClip } from './splice-clip'

const PROJECT = join(REPO, 'samples/unity')
const HUB = '/Applications/Unity/Hub/Editor'

function findUnity(): string | undefined {
  if (process.env.UNITY !== undefined) return process.env.UNITY
  if (!existsSync(HUB)) return undefined
  const versions = readdirSync(HUB).sort().reverse()
  for (const v of versions) {
    const bin = join(HUB, v, 'Unity.app/Contents/MacOS/Unity')
    if (existsSync(bin)) return bin
  }
  return undefined
}

export async function prepareUnity(paths: string[] = []): Promise<string[]> {
  const dir = join(PROJECT, 'Assets/Characters')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const clip = new Uint8Array(readFileSync(UAL_CLIP))
  const written: string[] = []
  for (const e of exportsToCheck(paths)) {
    const to = join(dir, e.file)
    copyFileSync(e.path, to)
    const walk = to.replace(/\.glb$/, '.walk.glb')
    await Bun.write(
      walk,
      spliceClip(new Uint8Array(readFileSync(e.path)), clip)
    )
    written.push(to, walk)
  }
  return written
}

/** The Web player build: into `out`, whose Build/ is then copied to the site. */
export function unityWebCommand(unity: string, out: string): string[] {
  return [
    unity,
    '-batchmode',
    '-nographics',
    '-projectPath',
    PROJECT,
    '-buildTarget',
    'WebGL',
    '-executeMethod',
    'Dramatis.WebBuild.Build',
    '-logFile',
    '-',
    '-dramatisWebOut',
    out,
  ]
}

const SITE_PLAYER = join(REPO, 'site/unity/player/Build')

export function unityCommand(unity: string, out: string): string[] {
  return [
    unity,
    '-batchmode',
    '-nographics',
    '-projectPath',
    PROJECT,
    '-executeMethod',
    'Dramatis.EngineCheck.Run',
    '-logFile',
    '-',
    '-dramatisOut',
    out,
  ]
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const prepareOnly = args.includes('--prepare-only')
  const files = await prepareUnity(args.filter((a) => !a.startsWith('--')))
  console.log(
    `copied ${files.length} files into samples/unity/Assets/Characters/`
  )
  const unity = findUnity()
  if (args.includes('--web')) {
    const built = join(PROJECT, 'Builds/player')
    const cmd = unityWebCommand(
      unity ?? `${HUB}/<version>/Unity.app/Contents/MacOS/Unity`,
      built
    )
    if (unity === undefined) {
      console.log(
        `NOT RUN: no Unity editor found (set UNITY). Run:\n\n  ${cmd.join(
          ' '
        )}\n`
      )
      process.exit(2)
    }
    rmSync(built, { recursive: true, force: true })
    const r = await run(cmd)
    const from = join(built, 'Build')
    if (r.code !== 0 || !existsSync(from)) {
      console.error(
        `The Web build failed (exit ${r.code}):\n${r.out.slice(-4000)}`
      )
      process.exit(1)
    }
    rmSync(SITE_PLAYER, { recursive: true, force: true })
    cpSync(from, SITE_PLAYER, { recursive: true })
    console.log(
      `Web player built: ${readdirSync(SITE_PLAYER).join(
        ', '
      )} in site/unity/player/Build. Commit it.`
    )
    process.exit(0)
  }
  const out = join(PROJECT, 'dramatis-results.json')
  const cmd = unityCommand(
    unity ?? `${HUB}/<version>/Unity.app/Contents/MacOS/Unity`,
    out
  )
  if (prepareOnly || unity === undefined) {
    console.log(
      `${
        unity === undefined
          ? 'NOT RUN: no Unity editor found (set UNITY).'
          : 'Prepared.'
      } Run:\n\n  ${cmd
        .map((a) => (/[ <>]/.test(a) ? `"${a}"` : a))
        .join(' ')}\n`
    )
    process.exit(unity === undefined ? 2 : 0)
  }
  rmSync(out, { force: true })
  const r = await run(cmd)
  if (!existsSync(out)) {
    console.error(
      `Unity wrote no results (exit ${r.code}):\n${r.out.slice(-4000)}`
    )
    process.exit(2)
  }
  const parsed = JSON.parse(readFileSync(out, 'utf8')) as {
    unity: string
    gltfast: string
    characters: CharacterResult[]
  }
  const failed = report(
    `Unity ${parsed.unity}, glTFast ${parsed.gltfast}`,
    parsed.characters
  )
  process.exit(failed > 0 ? 1 : 0)
}
