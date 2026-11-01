// Fetching the human pack from the CDN, for scripts and the network test tier
// (Bun or Node only: it caches on disk). Not reachable from any public entry.
//
// The pack's binaries are named by their content hash, so a cached copy of a
// URL is never stale; the manifest's own URL carries the pack version.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The hm08 pack the creator loads (tosijs-3d's `loadCharacterAssets`). */
export const HM08_PACK_URL =
  'https://cdn.tosijs.net/makehuman/hm08/hm08.json?v=17'

/** The repo's own cache directory (git-ignored). */
export const CACHE_DIR = join(import.meta.dir, '..', '..', '.cache', 'cdn')

/**
 * A fetcher for `loadHumanPack` and `BuildOptions.fetch` that keeps every
 * response on disk under `dir`, so a second run is offline.
 */
export function cachedFetch(
  dir: string = CACHE_DIR
): (url: string) => Promise<ArrayBuffer> {
  mkdirSync(dir, { recursive: true })
  return async (url) => {
    const key = createHash('sha256').update(url).digest('hex').slice(0, 32)
    const path = join(dir, key)
    try {
      const b = readFileSync(path)
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    } catch {
      // not cached yet
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`)
    const bytes = await res.arrayBuffer()
    writeFileSync(path, new Uint8Array(bytes))
    return bytes
  }
}
