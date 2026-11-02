// Builds the Unity player's page (/unity/) like the viewer and the demo: the
// page's script and index.html, plus the Web build in site/unity/player/ when
// there is one (bun tools/engines/unity.ts --web). Run by site/config.ts's
// prebuild; also runnable alone: `bun site/unity/build.ts`.

import { join } from 'node:path'
import { buildThreePage } from '../three-page'

const ROOT = join(import.meta.dir, '..', '..')
/** The static dir site/config.ts copies into the site root. */
export const UNITY_STATIC = join(ROOT, '.cache', 'unity-static')
export const UNITY_OUT = join(UNITY_STATIC, 'unity')
/** The committed Web build: Build/player.* */
export const UNITY_PLAYER = join(import.meta.dir, 'player')

export function buildUnityPage(out: string = UNITY_OUT): Promise<boolean> {
  return buildThreePage({
    label: 'unity',
    entry: join(import.meta.dir, 'main.ts'),
    html: join(import.meta.dir, 'index.html'),
    out,
    dirs: { player: join(UNITY_PLAYER, 'Build') },
  })
}

if (import.meta.main) process.exit((await buildUnityPage()) ? 0 : 1)
