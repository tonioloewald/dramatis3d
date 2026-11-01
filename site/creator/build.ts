// Builds the creator's heavy half (app.ts) as its own ES module bundle, apart
// from the site's shared IIFE, so only the creator page downloads Babylon.
// Run by site/config.ts's prebuild; the output is copied into the site root
// as a static dir (`/creator-app/`). Also runnable alone: `bun site/creator/build.ts`.

import { mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
/** The static dir site/config.ts copies into the site root. */
export const CREATOR_STATIC = join(ROOT, '.cache', 'creator-static')
const OUT = join(CREATOR_STATIC, 'creator-app')

export async function buildCreatorApp(): Promise<boolean> {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, 'app.ts')],
    outdir: OUT,
    target: 'browser',
    format: 'esm',
    minify: true,
    sourcemap: 'linked',
    naming: { entry: 'app.js', chunk: '[name]-[hash].js' },
    // tosijs-3d's physics plugin imports it lazily; the creator never uses it.
    external: ['jolt-physics'],
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return false
  }
  for (const out of result.outputs) {
    if (!out.path.endsWith('.js')) continue
    const bytes = statSync(out.path).size
    const gz = Bun.gzipSync(await Bun.file(out.path).bytes()).byteLength
    console.log(
      `creator: ${out.path.slice(OUT.length + 1)} ${(bytes / 1e6).toFixed(
        2
      )} MB (${(gz / 1e6).toFixed(2)} MB gzip)`
    )
  }
  return true
}

if (import.meta.main) process.exit((await buildCreatorApp()) ? 0 : 1)
