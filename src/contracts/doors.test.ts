// The entry doors are a closed set (src/contracts/doors.ts): a page that reads
// its URL must be listed, every query parameter it reads must be a listed
// door, and every door has hostile-input tests (oversize, malformed,
// prototype keys) named `hostile <door>: …`.

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Glob } from 'bun'
import { ENTRY_DOORS } from './doors'

const ROOT = join(import.meta.dir, '..', '..')
const SKIP = /(\.test\.ts$|node_modules|\/Build\/|\/player\/|\/\.claude\/)/

/** Page sources: site and sample code, not tests or built players. */
const sources = [
  ...new Glob('{site,samples}/**/*.ts').scanSync({ cwd: ROOT }),
].filter((f) => !SKIP.test(f))

const READS_URL = /location\.(hash|search)|new URL\(location|searchParams/
const QUERY =
  /\b(?:params|searchParams|URLSearchParams\([^)]*\))\.get\(([^)]+)\)/g
/** How each door's query name is spelt in source. */
const QUERY_NAMES: Record<string, string[]> = {
  '?handoff=': ['HANDOFF_PARAM', "'handoff'"],
  '?glb=': ['GLB_URL_PARAM', "'glb'"],
}

describe('entry doors', () => {
  test('every page that reads its URL is a listed door', () => {
    const listed = new Set(
      ENTRY_DOORS.filter((d) => /^[?#]/.test(d.door)).flatMap((d) => d.pages)
    )
    const readers = sources.filter((f) =>
      READS_URL.test(readFileSync(join(ROOT, f), 'utf8'))
    )
    expect(readers.length).toBeGreaterThan(3)
    expect(readers.filter((f) => !listed.has(f))).toEqual([])
  })

  test('every query parameter read is a door, on a page listed for it', () => {
    const stray: string[] = []
    for (const f of sources) {
      const text = readFileSync(join(ROOT, f), 'utf8')
      for (const [, arg] of text.matchAll(QUERY)) {
        const door = Object.keys(QUERY_NAMES).find((d) =>
          QUERY_NAMES[d]!.includes(arg!.trim())
        )
        const ok =
          door && ENTRY_DOORS.find((d) => d.door === door)!.pages.includes(f)
        if (!ok) stray.push(`${f}: get(${arg})`)
      }
    }
    expect(stray).toEqual([])
  })

  test('the hash is read only by the share link', () => {
    const hash = sources.filter((f) =>
      /location\.hash/.test(readFileSync(join(ROOT, f), 'utf8'))
    )
    expect(hash).toEqual(ENTRY_DOORS.find((d) => d.door === '#c=')!.pages)
  })

  for (const d of ENTRY_DOORS)
    test(`${d.door} has hostile-input tests: oversize, malformed, prototype keys`, () => {
      const text = readFileSync(join(ROOT, d.tests), 'utf8')
      for (const kind of ['oversize', 'malformed', 'prototype keys'])
        expect(text).toContain(`hostile ${d.door}: ${kind}`)
    })
})
