// Builds the three.js viewer (/viewer/) as its own page, apart from the doc
// site: index.html, main.js (three.js and the viewer, minified) and the CC0
// UAL clip it plays first. Run by site/config.ts's prebuild; the output is
// copied into the site root as a static dir. Also runnable alone:
// `bun site/viewer/build.ts`. The work, and the no-Babylon check, are in
// site/three-page.ts.

import { join } from 'node:path'
import { buildThreePage } from '../three-page'

export { BABYLON_MARKERS } from '../three-page'

const ROOT = join(import.meta.dir, '..', '..')
/** The static dir site/config.ts copies into the site root. */
export const VIEWER_STATIC = join(ROOT, '.cache', 'viewer-static')
/** Where the page lands, under the static dir: the contract's VIEWER_PATH. */
export const VIEWER_OUT = join(VIEWER_STATIC, 'viewer')
/** The bundled clip: UAL's Walk_Loop (CC0), the gate-1 fixture. */
export const WALK_CLIP = join(ROOT, 'test', 'gate1', 'fixtures', 'ual-walk.glb')

export function buildViewer(out: string = VIEWER_OUT): Promise<boolean> {
  return buildThreePage({
    label: 'viewer',
    entry: join(import.meta.dir, 'main.ts'),
    html: join(import.meta.dir, 'index.html'),
    out,
    files: { 'ual-walk.glb': WALK_CLIP },
  })
}

if (import.meta.main) process.exit((await buildViewer()) ? 0 : 1)
