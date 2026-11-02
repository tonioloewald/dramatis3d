// The library's shipped size, and its delta against the committed baseline
// (dist-sizes.json; tosijs-coding-practices releasing.md "Track bundle size").
//
//   bun bin/sizes.ts             print raw and gzip sizes per dist/ .js file
//   bun bin/sizes.ts --record    re-record the baseline: do it when cutting a tag
//
// `bun run build` prints the same table. The baseline names the version it was
// recorded at, so a stale one shows in the delta line instead of hiding in it.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const ROOT = join(import.meta.dir, '..')
const BASELINE = join(ROOT, 'dist-sizes.json')

export interface Size {
  raw: number
  gz: number
}

export interface Baseline {
  version: string
  sizes: Record<string, Size>
}

/** Every shipped .js under dist/ by repo-relative path; hashed chunks share one key. */
export function measure(dist = join(ROOT, 'dist')): Record<string, Size> {
  const sizes: Record<string, Size> = {}
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.js')) {
        const bytes = readFileSync(full)
        // Bun names a shared chunk index-<hash>.js, and the hash moves with its
        // content, so the baseline keys it by shape.
        const key = relative(ROOT, full).replace(
          /-[a-z0-9]{8}\.js$/,
          '-[hash].js'
        )
        const prev = sizes[key] ?? { raw: 0, gz: 0 }
        sizes[key] = {
          raw: prev.raw + bytes.length,
          gz: prev.gz + gzipSync(bytes, { level: 9 }).length,
        }
      }
    }
  }
  walk(dist)
  return sizes
}

const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`
const delta = (now: number, before: number | undefined): string =>
  before === undefined
    ? 'new'
    : `${now - before >= 0 ? '+' : ''}${now - before} B`

export function printSizes(record = false): void {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const sizes = measure()
  const baseline: Baseline | undefined = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, 'utf8'))
    : undefined
  console.log(
    baseline
      ? `library size vs dist-sizes.json (recorded at ${baseline.version}):`
      : 'library size (no dist-sizes.json baseline):'
  )
  for (const [file, s] of Object.entries(sizes).sort()) {
    const was = baseline?.sizes[file]?.gz
    console.log(
      `  ${file}: ${kb(s.raw)} (${kb(s.gz)} gzip)` +
        (baseline ? `  ${delta(s.gz, was)} gzip` : '')
    )
  }
  for (const file of Object.keys(baseline?.sizes ?? {}))
    if (!sizes[file]) console.log(`  ${file}: gone`)
  if (record) {
    const out: Baseline = { version: pkg.version, sizes }
    writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n')
    console.log(`recorded dist-sizes.json at ${pkg.version}`)
  }
}

if (import.meta.main) printSizes(process.argv.includes('--record'))
