// The Unity Web player moves like the three.js demo: its movement
// (samples/unity/Assets/Dramatis/Runtime/Walk.cs) is compiled with Mono and
// run on the same cases as site/demo/core.ts, whose answers it must match.
// Unity is left-handed, so a direction is compared mirrored in x (and a yaw
// negated), the way glTFast mirrors a file on import.
//
// Needs Mono (`mcs`, `mono`); without them every test here is skipped and
// reported NOT RUN. No Unity editor is needed: Walk.cs uses no UnityEngine.

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  collide,
  gaitFor,
  headingOf,
  pillarRing,
  steer,
  towardGoal,
  turnToward,
} from '../../site/demo/core'
import { REPO } from './common'

const WALK = join(REPO, 'samples/unity/Assets/Dramatis/Runtime/Walk.cs')
const mono = Bun.which('mono')
const mcs = Bun.which('mcs')
const HAVE = mono !== null && mcs !== null
if (!HAVE) console.log('unity walk: NOT RUN (needs Mono: mcs and mono)')

const STEERS: [number, number, number][] = [
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0.3],
  [-1, 0, 2],
  [0, -1, -1.2],
  [1, -1, Math.PI],
]
const SPEEDS = [0, 0.5, 1.4, 3, 4.9, 9]
const TURNS: [number, number, number][] = [
  [3, -3, 1],
  [0, 1, 0.25],
  [-2, 2, 0.5],
]
const GOALS: [number, number, number, number][] = [
  [0, 0, 3, 4],
  [3, 4, 3.05, 4],
]
const COLLIDES: [number, number][] = [
  [0.1, 0],
  [20, -20],
  [6.8, 2.5],
]

/** A C# program that prints the same cases as JSON lines. */
function harness(): string {
  const f = (x: number) => `${x}`
  const lines: string[] = []
  for (const s of SPEEDS) lines.push(`Out("gait", Walk.GaitFor(${f(s)}).name);`)
  for (const [a, b, y] of STEERS)
    lines.push(
      `{ var d = Walk.Steer(${f(a)}, ${f(b)}, ${f(
        y
      )}); Out("steer", d == null ? "null" : Num(d.Value.x) + "," + Num(d.Value.z)); }`
    )
  for (const [c, t, m] of TURNS)
    lines.push(`Out("turn", Num(Walk.TurnToward(${f(c)}, ${f(t)}, ${f(m)})));`)
  for (const [x, z, gx, gz] of GOALS)
    lines.push(
      `{ var d = Walk.TowardGoal(new Flat(${f(x)}, ${f(z)}), new Flat(${f(
        gx
      )}, ${f(
        gz
      )})); Out("goal", d == null ? "null" : Num(d.Value.x) + "," + Num(d.Value.z)); }`
    )
  for (const [x, z] of COLLIDES)
    lines.push(
      `{ var c = Walk.Collide(new Flat(${f(x)}, ${f(
        z
      )}), 0.3, Walk.PillarRing(), 15); Out("collide", Num(c.x) + "," + Num(c.z)); }`
    )
  lines.push(
    `foreach (var p in Walk.PillarRing()) Out("pillar", Num(p.x) + "," + Num(p.z) + "," + Num(p.r));`
  )
  lines.push(`Out("heading", Num(Walk.HeadingOf(new Flat(1, 0))));`)
  return `using System; using System.Globalization; using Dramatis;
static class Harness {
  static string Num(double x) => x.ToString("R", CultureInfo.InvariantCulture);
  static void Out(string k, string v) => Console.WriteLine(k + " " + v);
  static void Main() { ${lines.join('\n    ')} }
}`
}

async function runCs(): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), 'unity-walk-'))
  const src = join(dir, 'Harness.cs')
  const exe = join(dir, 'harness.exe')
  writeFileSync(src, harness())
  const build = Bun.spawnSync([mcs!, '-nologo', `-out:${exe}`, WALK, src])
  if (build.exitCode !== 0)
    throw new Error(
      `mcs failed:\n${build.stdout.toString()}${build.stderr.toString()}`
    )
  const ran = Bun.spawnSync([mono!, exe])
  if (ran.exitCode !== 0) throw new Error(ran.stderr.toString())
  return ran.stdout.toString().trim().split('\n')
}

const pair = (v: string) => v.split(',').map(Number)

describe.skipIf(!HAVE)('Walk.cs (Unity) against site/demo/core.ts', () => {
  test('compiles with no UnityEngine, and every case agrees', async () => {
    const out = await runCs()
    const take = (kind: string) =>
      out
        .filter((l) => l.startsWith(kind + ' '))
        .map((l) => l.slice(kind.length + 1))

    expect(take('gait')).toEqual(SPEEDS.map((s) => gaitFor(s).name))

    const steers = take('steer')
    STEERS.forEach(([f, r, yaw], i) => {
      // Unity's yaw y is three's -y, and its x is three's -x.
      const three = steer({ forward: f, right: r, run: false }, -yaw)!
      const [x, z] = pair(steers[i]!)
      expect(x).toBeCloseTo(-three.x, 9)
      expect(z).toBeCloseTo(three.z, 9)
    })

    const turns = take('turn')
    TURNS.forEach(([c, t, m], i) =>
      expect(Number(turns[i])).toBeCloseTo(turnToward(c, t, m), 9)
    )

    const goals = take('goal')
    GOALS.forEach(([x, z, gx, gz], i) => {
      const t = towardGoal({ x, z }, { x: gx, z: gz })
      if (t === null) expect(goals[i]).toBe('null')
      else {
        const [a, b] = pair(goals[i]!)
        expect(a).toBeCloseTo(t.x, 9)
        expect(b).toBeCloseTo(t.z, 9)
      }
    })

    const collides = take('collide')
    COLLIDES.forEach(([x, z], i) => {
      const t = collide({ x, z }, 0.3, pillarRing(), 15)
      const [a, b] = pair(collides[i]!)
      expect(a).toBeCloseTo(t.x, 9)
      expect(b).toBeCloseTo(t.z, 9)
    })

    const pillars = take('pillar').map(pair)
    expect(pillars.length).toBe(pillarRing().length)
    pillarRing().forEach((p, i) => {
      expect(pillars[i]![0]).toBeCloseTo(p.x, 9)
      expect(pillars[i]![1]).toBeCloseTo(p.z, 9)
      expect(pillars[i]![2]).toBeCloseTo(p.r, 9)
    })

    expect(Number(take('heading')[0])).toBeCloseTo(headingOf({ x: 1, z: 0 }), 9)
  }, 60_000)
})
