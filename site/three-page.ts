// Builds one of the site's standalone pages (the viewer, the demo, the Unity
// player's page) as its own
// static page: index.html, main.js and whatever files it ships with. Built in
// memory and synced, because the output is under a static dir the dev server
// watches (sync-dir.ts).
//
// The bundle must hold no Babylon: these pages are the proof that an export
// needs nothing of the creator's engine. The build fails if it finds any.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { buildOutputs, syncDir } from './sync-dir'

/** Strings that only a Babylon bundle contains. */
export const BABYLON_MARKERS = ['@babylonjs', 'BABYLON.', 'babylonjs.com']

export interface ThreePage {
  /** For the log lines: `viewer`, `demo`. */
  label: string
  /** The page's script. */
  entry: string
  /** Its index.html. */
  html: string
  /** Where the page lands (a dir under a static dir). */
  out: string
  /** Files shipped beside it: published name to source path. */
  files?: Record<string, string>
  /** Folders shipped beside it, when they exist: published dir to source dir. */
  dirs?: Record<string, string>
}

export async function buildThreePage(page: ThreePage): Promise<boolean> {
  const result = await Bun.build({
    entrypoints: [page.entry],
    target: 'browser',
    format: 'esm',
    minify: true,
    sourcemap: 'linked',
    naming: { entry: 'main.js', chunk: '[name]-[hash].js' },
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return false
  }
  const files = await buildOutputs(result.outputs)
  for (const [path, bytes] of files) {
    if (!path.endsWith('.js')) continue
    const text = new TextDecoder().decode(bytes)
    const leak = BABYLON_MARKERS.find((m) => text.includes(m))
    if (leak) {
      console.error(
        `${page.label}: ${path} contains "${leak}": Babylon leaked in`
      )
      return false
    }
  }
  files.set('index.html', readFileSync(page.html))
  for (const [name, source] of Object.entries(page.files ?? {}))
    files.set(name, readFileSync(source))
  for (const [name, source] of Object.entries(page.dirs ?? {})) {
    if (!existsSync(source)) continue
    for (const e of readdirSync(source, {
      recursive: true,
      withFileTypes: true,
    }))
      if (e.isFile())
        files.set(
          join(name, relative(source, join(e.parentPath, e.name))),
          readFileSync(join(e.parentPath, e.name))
        )
  }
  const written = await syncDir(page.out, files)
  for (const [path, bytes] of files) {
    if (!path.endsWith('.js') || !written.includes(path)) continue
    const gz = Bun.gzipSync(bytes).byteLength
    console.log(
      `${page.label}: ${path} ${(bytes.byteLength / 1e3).toFixed(0)} KB (${(
        gz / 1e3
      ).toFixed(0)} KB gzip)`
    )
  }
  return true
}
