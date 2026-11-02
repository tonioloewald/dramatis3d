import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncDir } from './sync-dir'

// The prebuild writes into static dirs the dev server watches; a build that
// rewrites unchanged files loops forever (tosijs-ui stops it after 30 rebuilds).
const bytes = (s: string) => new TextEncoder().encode(s)

describe('syncDir', () => {
  test('a repeat sync of the same files writes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sync-dir-'))
    const files = new Map([
      ['a.js', bytes('a')],
      ['sub/b.js', bytes('b')],
    ])
    expect((await syncDir(dir, files)).sort()).toEqual(['a.js', 'sub/b.js'])
    const before = statSync(join(dir, 'a.js')).mtimeMs
    expect(await syncDir(dir, files)).toEqual([])
    expect(statSync(join(dir, 'a.js')).mtimeMs).toBe(before)
  })

  test('changed files are rewritten and files no longer built are removed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sync-dir-'))
    await syncDir(
      dir,
      new Map([
        ['a.js', bytes('a')],
        ['old-chunk.js', bytes('x')],
      ])
    )
    const written = await syncDir(dir, new Map([['a.js', bytes('A')]]))
    expect(written).toEqual(['a.js'])
    expect(await Bun.file(join(dir, 'a.js')).text()).toBe('A')
    expect(existsSync(join(dir, 'old-chunk.js'))).toBe(false)
  })
})
