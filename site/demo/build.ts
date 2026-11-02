// Builds the three.js demo (/demo/) as its own page, like the viewer: run by
// site/config.ts's prebuild, copied into the site root as a static dir. Also
// runnable alone: `bun site/demo/build.ts`. The work, and the no-Babylon
// check, are in site/three-page.ts.

import { join } from 'node:path'
import { buildThreePage } from '../three-page'

const ROOT = join(import.meta.dir, '..', '..')
/** The static dir site/config.ts copies into the site root. */
export const DEMO_STATIC = join(ROOT, '.cache', 'demo-static')
export const DEMO_OUT = join(DEMO_STATIC, 'demo')

export function buildDemo(out: string = DEMO_OUT): Promise<boolean> {
  return buildThreePage({
    label: 'demo',
    entry: join(import.meta.dir, 'main.ts'),
    html: join(import.meta.dir, 'index.html'),
    out,
  })
}

if (import.meta.main) process.exit((await buildDemo()) ? 0 : 1)
