// Builds the creator's heavy half (app.ts) as its own ES module bundle, apart
// from the site's shared IIFE, so only the creator page downloads Babylon.
// Run by site/config.ts's prebuild; the output is copied into the site root
// as a static dir (`/creator-app/`). Also runnable alone: `bun site/creator/build.ts`.

import { join } from 'node:path'
import { buildOutputs, syncDir } from '../sync-dir'

const ROOT = join(import.meta.dir, '..', '..')
/** The static dir site/config.ts copies into the site root. */
export const CREATOR_STATIC = join(ROOT, '.cache', 'creator-static')
const OUT = join(CREATOR_STATIC, 'creator-app')

/**
 * The creator's script may not grow past this, gzip -9 (#3670); the build
 * fails over it. site/docs/creator.md says "about 2.5 MB of script". History:
 * 2.49 MB at 0.1.0, 2.48 MB 2026-11-03, 2.59 MB 2026-11-19 (tosijs-3d
 * 0.13.1). Raised 2.6 -> 2.62 MB 2026-11-20: tosijs-3d 0.13.2 adds 17 KB
 * gzip, mostly the scene element's static import of the dev server's test
 * checklist (b3d-checklist, #4221) and gamepad panel focus (pad-ui); the clip table
 * is 3 KB. 2.61 MB. Lower it when the script shrinks; never raise it without
 * saying why here.
 */
export const CREATOR_GZIP_CEILING = 2.62e6

export async function buildCreatorApp(): Promise<boolean> {
  // Built in memory and synced: OUT is under a watched static dir (sync-dir.ts).
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, 'app.ts')],
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
  const files = await buildOutputs(result.outputs)
  const written = await syncDir(OUT, files)
  for (const [path, bytes] of files) {
    if (!path.endsWith('.js')) continue
    const gz = Bun.gzipSync(bytes, { level: 9 }).byteLength
    if (path === 'app.js' && gz > CREATOR_GZIP_CEILING) {
      console.error(
        `creator: app.js is ${(gz / 1e6).toFixed(2)} MB gzip, over its ${
          CREATOR_GZIP_CEILING / 1e6
        } MB ceiling (CREATOR_GZIP_CEILING, #3670)`
      )
      return false
    }
    if (!written.includes(path)) continue
    console.log(
      `creator: ${path} ${(bytes.byteLength / 1e6).toFixed(2)} MB (${(
        gz / 1e6
      ).toFixed(2)} MB gzip)`
    )
  }
  return true
}

if (import.meta.main) process.exit((await buildCreatorApp()) ? 0 : 1)
