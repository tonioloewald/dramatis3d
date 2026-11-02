// Spike 1: run every engine check that can run on this machine and print
// one summary. Unity and Unreal are not run here (see samples/unity/ and
// site/docs/guide-unreal.md); they are listed as NOT RUN.
//
//   bun tools/engines/run.ts [--json <out.json>] [--render <dir>]
//
// Exits 1 when any check that ran failed.

import { runBabylon } from './babylon'
import { runBlender } from './blender'
import { type CharacterResult, report } from './common'
import { renderGodot, runGodot } from './godot'

const args = process.argv.slice(2)
const at = (flag: string) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const jsonOut = at('--json')
const renderDir = at('--render')

const summary: Array<{
  engine: string
  version: string
  status: 'ran' | 'NOT RUN'
  note?: string
  pass: number
  fail: number
  characters?: CharacterResult[]
  log?: string[]
}> = []

const tally = (cs: CharacterResult[]) => {
  const all = cs.flatMap((c) => c.checks)
  return {
    pass: all.filter((k) => k.ok).length,
    fail: all.filter((k) => !k.ok).length,
  }
}

const godot = await runGodot()
if (godot.ran) {
  report(`Godot ${godot.version}`, godot.characters)
  summary.push({
    engine: 'godot',
    version: godot.version,
    status: 'ran',
    ...tally(godot.characters),
    characters: godot.characters,
    log: godot.importLog,
  })
  if (renderDir !== undefined)
    for (const p of await renderGodot(renderDir)) console.log(`rendered ${p}`)
} else
  summary.push({
    engine: 'godot',
    version: godot.version,
    status: 'NOT RUN',
    note: godot.error,
    pass: 0,
    fail: 0,
  })

const blender = await runBlender()
if (blender.ran) {
  report(`Blender ${blender.version}`, blender.characters)
  summary.push({
    engine: 'blender',
    version: blender.version,
    status: 'ran',
    ...tally(blender.characters),
    characters: blender.characters,
    log: blender.log,
  })
} else
  summary.push({
    engine: 'blender',
    version: '',
    status: 'NOT RUN',
    note: blender.error,
    pass: 0,
    fail: 0,
  })

const babylon = await runBabylon()
if (babylon.ran) {
  report(`Babylon.js ${babylon.version}`, babylon.characters)
  summary.push({
    engine: 'babylon',
    version: babylon.version,
    status: 'ran',
    ...tally(babylon.characters),
    characters: babylon.characters,
    log: [...new Set(babylon.log)],
  })
} else
  summary.push({
    engine: 'babylon',
    version: babylon.version,
    status: 'NOT RUN',
    note: 'no exports',
    pass: 0,
    fail: 0,
  })

summary.push({
  engine: 'three.js',
  version: '',
  status: 'NOT RUN',
  note: 'covered by bun run gate1 (GLTFLoader + AnimationMixer)',
  pass: 0,
  fail: 0,
})
summary.push({
  engine: 'unity',
  version: '',
  status: 'NOT RUN',
  note: 'needs the editor: samples/unity/README.md',
  pass: 0,
  fail: 0,
})
summary.push({
  engine: 'unreal',
  version: '',
  status: 'NOT RUN',
  note: 'instructions only: site/docs/guide-unreal.md',
  pass: 0,
  fail: 0,
})

console.log('\n== summary ==')
for (const s of summary)
  console.log(
    `${s.engine.padEnd(9)} ${
      s.status === 'ran'
        ? `${s.pass} pass, ${s.fail} fail`
        : `NOT RUN (${s.note})`
    }  ${s.version}`
  )
if (jsonOut !== undefined)
  await Bun.write(
    jsonOut,
    `${JSON.stringify({ date: new Date().toISOString(), summary }, null, 2)}\n`
  )
process.exit(summary.some((s) => s.fail > 0) ? 1 : 0)
