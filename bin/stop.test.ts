import { describe, expect, test } from 'bun:test'
import { spawn } from 'bun'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { processCwd, stopDecision, type LockHolder } from './stop'

// `bun run stop` used to SIGTERM whatever live pid the build lock named
// (reviews/0.1.0-pre-minor.md, B1): a running `bun run build`, or after pid
// reuse, an unrelated process. It may signal only this project's dev server.

const ROOT = '/work/dramatis3d'
const holder = (over: Partial<LockHolder> = {}): LockHolder => ({
  pid: 4242,
  role: 'dev-server',
  root: ROOT,
  port: 8018,
  ...over,
})

describe('bun run stop: who may be signalled', () => {
  test('nothing holds the lock: nothing to do', () => {
    expect(stopDecision(null, () => ROOT).action).toBe('none')
  })

  test("this project's dev server is signalled", () => {
    const d = stopDecision(holder(), () => ROOT, 1)
    expect(d).toMatchObject({ action: 'signal', pid: 4242 })
  })

  test('a build holding the lock is refused, not killed', () => {
    const d = stopDecision(holder({ role: 'build' }), () => ROOT, 1)
    expect(d.action).toBe('refuse')
  })

  test('a reused pid working somewhere else is refused', () => {
    const d = stopDecision(holder(), () => '/Users/someone/other-project', 1)
    expect(d.action).toBe('refuse')
  })

  test("a pid whose cwd can't be read is refused", () => {
    const d = stopDecision(holder(), () => undefined, 1)
    expect(d.action).toBe('refuse')
  })

  test('the lock naming this very process is refused', () => {
    const d = stopDecision(holder({ pid: 7 }), () => ROOT, 7)
    expect(d.action).toBe('refuse')
  })

  test("processCwd reads a live process's working directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dramatis-stop-'))
    const child = spawn(['sleep', '5'], { cwd: dir })
    try {
      const cwd = processCwd(child.pid)
      // lsof reports the real path (/private/var/... on macOS).
      expect(
        cwd &&
          stopDecision(holder({ pid: child.pid, root: dir }), () => cwd, 1)
            .action
      ).toBe('signal')
      expect(
        stopDecision(holder({ pid: child.pid, root: ROOT }), processCwd, 1)
          .action
      ).toBe('refuse')
    } finally {
      child.kill()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
