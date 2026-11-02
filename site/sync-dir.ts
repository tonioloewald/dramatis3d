// Writes a build's files into a directory the dev server WATCHES (the prebuild's
// static dirs), touching only what changed. Wiping the dir and writing every file
// afresh makes each build trigger the next: tosijs-ui's dev server stops after 30
// back-to-back rebuilds. Unchanged files are left alone, and files no longer
// produced are removed.

import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/** Every file under `dir`, as paths relative to it. */
function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)))
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Make `dir` hold exactly `files` (relative path to bytes). Returns the paths
 * written, so a caller (or a test) can see that a repeat build wrote nothing.
 */
export async function syncDir(
  dir: string,
  files: ReadonlyMap<string, Uint8Array>
): Promise<string[]> {
  mkdirSync(dir, { recursive: true })
  for (const stale of listFiles(dir))
    if (!files.has(stale)) rmSync(join(dir, stale))
  const written: string[] = []
  for (const [path, bytes] of files) {
    const target = join(dir, path)
    const file = Bun.file(target)
    if ((await file.exists()) && same(await file.bytes(), bytes)) continue
    mkdirSync(dirname(target), { recursive: true })
    await Bun.write(target, bytes)
    written.push(path)
  }
  return written
}

/** A Bun.build run without `outdir`, as the files it would have written. */
export async function buildOutputs(
  outputs: readonly { path: string; arrayBuffer(): Promise<ArrayBuffer> }[]
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  for (const o of outputs)
    files.set(
      o.path.replace(/^\.\//, ''),
      new Uint8Array(await o.arrayBuffer())
    )
  return files
}
