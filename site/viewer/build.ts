// Builds the three.js viewer (/viewer/) as its own page, apart from the doc
// site: index.html, main.js (three.js and the viewer, minified) and the CC0
// UAL clip it plays first. Run by site/config.ts's prebuild; the output is
// copied into the site root as a static dir. Also runnable alone:
// `bun site/viewer/build.ts`.
//
// The bundle must hold no Babylon: the viewer is the proof that an export
// needs nothing of the creator's engine. The build fails if it finds any.

import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
/** The static dir site/config.ts copies into the site root. */
export const VIEWER_STATIC = join(ROOT, '.cache', 'viewer-static')
/** Where the page lands, under the static dir: the contract's VIEWER_PATH. */
export const VIEWER_OUT = join(VIEWER_STATIC, 'viewer')
/** The bundled clip: UAL's Walk_Loop (CC0), the gate-1 fixture. */
export const WALK_CLIP = join(ROOT, 'test', 'gate1', 'fixtures', 'ual-walk.glb')

/** Strings that only a Babylon bundle contains. */
export const BABYLON_MARKERS = ['@babylonjs', 'BABYLON.', 'babylonjs.com']

export async function buildViewer(out: string = VIEWER_OUT): Promise<boolean> {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, 'main.ts')],
    outdir: out,
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
  for (const o of result.outputs) {
    if (!o.path.endsWith('.js')) continue
    const text = await Bun.file(o.path).text()
    const leak = BABYLON_MARKERS.find((m) => text.includes(m))
    if (leak) {
      console.error(`viewer: ${o.path} contains "${leak}": Babylon leaked in`)
      return false
    }
    const gz = Bun.gzipSync(new TextEncoder().encode(text)).byteLength
    console.log(
      `viewer: ${o.path.slice(out.length + 1)} ${(
        statSync(o.path).size / 1e3
      ).toFixed(0)} KB (${(gz / 1e3).toFixed(0)} KB gzip)`
    )
  }
  copyFileSync(join(import.meta.dir, 'index.html'), join(out, 'index.html'))
  copyFileSync(WALK_CLIP, join(out, 'ual-walk.glb'))
  return true
}

if (import.meta.main) process.exit((await buildViewer()) ? 0 : 1)
