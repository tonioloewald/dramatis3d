// Shared by the engine runners (spike 1): which exports to check, what the
// export profile expects of them, and how a result is printed. The profile
// is site/docs/export-format.md; its names come from src/contracts/profile.ts
// so an engine check and the gate-1 harness can never disagree about them.

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import {
  EXTRAS_KEY,
  MAJOR_JOINTS,
  MIXAMO_NAMES,
  UE_JOINTS,
} from '../../src/contracts/profile'
import { readGlb } from 'tosijs-3d/glb-chunks'

export const REPO = resolve(import.meta.dir, '../..')
export const SAMPLES_OUT = join(REPO, 'samples/out')
/** Quaternius' UAL `Walk_Loop`, CC0, the gate's third-party clip. */
export const UAL_CLIP = join(REPO, 'test/gate1/fixtures/ual-walk.glb')

/** The joints whose world position must move, and the limbs that must turn (as gate 1). */
export const EXTREMITIES = ['Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r']
export const TURNING = MAJOR_JOINTS.filter((j) =>
  /^(upperarm|lowerarm|thigh|calf)_/.test(j)
)

export interface ExportInfo {
  file: string
  path: string
  naming: 'ue' | 'mixamo'
  faceUnits: string[]
}

/** Every `.glb` in samples/out (or the paths given), with what its extras declare. */
export function exportsToCheck(paths: string[] = []): ExportInfo[] {
  const files =
    paths.length > 0
      ? paths.map((p) => resolve(p))
      : readdirSync(SAMPLES_OUT)
          .filter((f) => f.endsWith('.glb'))
          .sort()
          .map((f) => join(SAMPLES_OUT, f))
  return files.map((path) => {
    const glb = readGlb(new Uint8Array(readFileSync(path)))
    const extras = glb.json.asset?.extras?.[EXTRAS_KEY] ?? {}
    return {
      file: basename(path),
      path,
      naming: extras.naming === 'mixamo' ? 'mixamo' : 'ue',
      faceUnits: Array.isArray(extras.faceUnits) ? extras.faceUnits : [],
    }
  })
}

/** The profile's skeleton and the gate's motion thresholds, for scripts in other languages. */
export function profileExpectations() {
  return {
    joints: UE_JOINTS.map((j) => ({
      name: j.name,
      parent: j.parent,
      mixamo: MIXAMO_NAMES[j.name] ?? j.name,
    })),
    majorJoints: [...MAJOR_JOINTS],
    extremities: EXTREMITIES,
    turning: TURNING,
  }
}

export interface Check {
  check: string
  ok: boolean
  evidence: string[]
}

export interface CharacterResult {
  file: string
  naming: string
  checks: Check[]
}

/** Print one engine's results; returns the number of failed checks. */
export function report(engine: string, characters: CharacterResult[]): number {
  let failed = 0
  console.log(`\n== ${engine} ==`)
  for (const c of characters) {
    console.log(`\n${c.file} (${c.naming})`)
    for (const k of c.checks) {
      if (!k.ok) failed++
      console.log(`  ${k.ok ? 'PASS' : 'FAIL'} ${k.check}`)
      for (const e of k.evidence ?? []) console.log(`       ${e}`)
    }
  }
  const total = characters.reduce((n, c) => n + c.checks.length, 0)
  console.log(`\n${engine}: ${total - failed} pass, ${failed} fail`)
  return failed
}

/** Run a command, capturing its output; never throws. */
export async function run(
  cmd: string[],
  cwd = REPO
): Promise<{ code: number; out: string }> {
  const p = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [o, e] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
  ])
  return { code: await p.exited, out: o + e }
}

/** Distinct `ERROR:`/`WARNING:` lines in an engine log, with counts. */
export function tallyLog(out: string): string[] {
  const counts = new Map<string, number>()
  for (const line of out.split('\n')) {
    const m = /^\s*(ERROR|WARNING|Error|Warning)[: ](.*)$/.exec(line)
    if (m === null) continue
    const key = `${m[1]!.toUpperCase()}: ${m[2]!.trim()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([k, n]) => `${n} x ${k}`)
}
