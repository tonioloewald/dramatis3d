// `bun run stop`: which pid, if any, may be signalled. Kept apart from bin/site.ts so
// the rule is testable without starting a build.
//
// tosijs-ui's build lock names a pid per project root, and `currentHolder` checks only
// that the pid is alive. That is not enough to SIGTERM it: the lock is also held by a
// one-off `bun run build` (or the e2e build), and a stale lock can name a pid the OS
// has since given to some unrelated process. So: only a dev-server holder, and only
// when the process is actually working in this project (its cwd is the lock's root),
// the same identity check tosijs-ui's own killStrayServer does before it signals.
// If the cwd can't be read, refuse rather than guess. (reviews/0.1.0-pre-minor.md, B1;
// the upstream fix, a `stopHolder` in tosijs-ui, is noted there.)

import { readlinkSync, realpathSync } from 'node:fs'

export interface LockHolder {
  pid: number
  role: string
  root: string
  port?: number
}

export type StopDecision =
  | { action: 'none' }
  | { action: 'signal'; pid: number; message: string }
  | { action: 'refuse'; message: string }

const real = (p: string): string => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

export function stopDecision(
  holder: LockHolder | null,
  cwdOf: (pid: number) => string | undefined,
  self: number = process.pid
): StopDecision {
  if (!holder) return { action: 'none' }
  const who = `pid ${holder.pid}, ${holder.role}, for ${holder.root}`
  if (holder.role !== 'dev-server')
    return {
      action: 'refuse',
      message: `The lock is held by a ${holder.role}, not a dev server (${who}). Not stopping it: let it finish.`,
    }
  if (holder.pid === self)
    return {
      action: 'refuse',
      message: `The lock names this process (${who}).`,
    }
  const cwd = cwdOf(holder.pid)
  if (cwd === undefined)
    return {
      action: 'refuse',
      message: `Can't read the working directory of ${who}, so can't tell it is this project's dev server. Not signalling it.`,
    }
  if (real(cwd) !== real(holder.root))
    return {
      action: 'refuse',
      message: `pid ${holder.pid} is working in ${cwd}, not ${holder.root}: the lock is stale and the pid belongs to something else. Not signalling it.`,
    }
  return {
    action: 'signal',
    pid: holder.pid,
    message: `Stopped dev-server for ${holder.root} (pid ${holder.pid}).`,
  }
}

/** The pid's working directory (/proc on Linux, `lsof` elsewhere); undefined if unreadable. */
export function processCwd(pid: number): string | undefined {
  if (process.platform === 'linux') {
    try {
      return readlinkSync(`/proc/${pid}/cwd`)
    } catch {
      return undefined
    }
  }
  try {
    const r = Bun.spawnSync([
      'lsof',
      '-a',
      '-d',
      'cwd',
      '-p',
      String(pid),
      '-Fn',
    ])
    if (r.exitCode !== 0) return undefined
    return r.stdout
      .toString()
      .split('\n')
      .find((l: string) => l.startsWith('n'))
      ?.slice(1)
      .trim()
  } catch {
    return undefined
  }
}
