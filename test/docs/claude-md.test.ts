import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// CLAUDE.md is the first thing every agent reads (AGENTS.md defers to it). It once kept
// saying "nothing is built" for a whole release after the code arrived (reviews/0.1.0-*).
const root = join(import.meta.dir, '..', '..')
const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
const scripts = Object.keys(
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts
)

describe('CLAUDE.md is true of the repo', () => {
  test('it does not claim the repo is empty', () => {
    expect(claude).not.toMatch(/Nothing is built|No code, `?package\.json/)
  })
  for (const name of scripts) {
    test(`it names the "${name}" script`, () => {
      expect(claude).toMatch(
        new RegExp(`bun (run )?${name.replace(':', '\\:')}\\b|bun ${name}\\b`)
      )
    })
  }
})
