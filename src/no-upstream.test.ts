// NEVER A PUBLISHED SECOND COPY (src/upstream/README.md rule 4, #3922): no
// public entry's bundle may reach src/upstream/, where code bound for
// tosijs-3d is prototyped. The 0.1.3 review found held-parts.ts bundled into
// dist/index.js, relying on memory at release time; this makes it a check.
// A deliberate keep, recorded by the owner, goes in KEEP with its reason.

import { describe, expect, test } from 'bun:test'
import { rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { BunPlugin } from 'bun'
import pkg from '../package.json'

const ROOT = join(import.meta.dir, '..')
const UPSTREAM = /[\\/]src[\\/]upstream[\\/]/

/** Files under src/upstream/ an entry may reach, each with its reason. */
const KEEP: Record<string, string> = {}

const ENTRIES = Object.entries(pkg.exports as Record<string, unknown>)
  .filter(([key]) => key !== './package.json')
  .map(([, target]) =>
    (target as { default: string }).default
      .replace(/^\.\/dist\//, 'src/')
      .replace(/\.js$/, '.ts')
  )

async function upstreamReached(entry: string): Promise<string[]> {
  const reached: string[] = []
  const record: BunPlugin = {
    name: 'record-upstream',
    setup(build) {
      build.onLoad({ filter: UPSTREAM }, (args) => {
        reached.push(relative(ROOT, args.path))
        return undefined as never
      })
    },
  }
  const r = await Bun.build({
    entrypoints: [join(ROOT, entry)],
    target: 'browser',
    external: ['three'],
    plugins: [record],
  })
  if (!r.success) throw new Error(r.logs.map(String).join('\n'))
  return reached.filter((f) => !(f in KEEP))
}

describe('no public entry ships src/upstream/', () => {
  for (const entry of ENTRIES)
    test(entry, async () => {
      expect(await upstreamReached(entry)).toEqual([])
    })

  test('positive control: an entry that imports src/upstream/ is caught', async () => {
    const probe = join(ROOT, 'src/upstream/__probe.ts')
    const entry = join(ROOT, 'src/__probe-entry.ts')
    try {
      writeFileSync(probe, 'export const probe = 1\n')
      writeFileSync(
        entry,
        "import { probe } from './upstream/__probe'\nconsole.log(probe)\n"
      )
      expect(await upstreamReached('src/__probe-entry.ts')).toEqual([
        'src/upstream/__probe.ts',
      ])
    } finally {
      rmSync(probe, { force: true })
      rmSync(entry, { force: true })
    }
  })
})
