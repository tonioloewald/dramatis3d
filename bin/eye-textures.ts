// Renders the eye SVGs to the PNGs the export fetches from the CDN. The art
// (Tonio Loewald, CC0) lives in static-assets, not here: cdn.tosijs.net/tonio/eyes/.
// A step run by hand after an SVG changes: the export has no SVG renderer,
// so it recolours these PNGs instead (tosijs-3d/eye-art's recolourEyePng).
//
//   bun bin/eye-textures.ts [--assets ../static-assets/assets/tonio/eyes]
//
// Then publish from static-assets (`bun run publish tonio/eyes --deploy`) and
// bump EYE_VERSION in tosijs-3d's eye-art (a tosijs-3d release): the CDN caches files as
// immutable, so new bytes need a new URL. Needs `bunx playwright-core install
// chromium`.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { EYE_STYLES } from 'tosijs-3d/eye-art'

const at = process.argv.indexOf('--assets')
const DIR =
  at > 0
    ? process.argv[at + 1]!
    : join(import.meta.dir, '..', '..', 'static-assets/assets/tonio/eyes')
const SIZE = 256

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 1,
})
for (const style of EYE_STYLES) {
  const svg = readFileSync(join(DIR, `${style}-eye.svg`), 'utf8')
  await page.setContent(
    `<html><body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(
      svg
    ).toString(
      'base64'
    )}" width="${SIZE}" height="${SIZE}" style="display:block"></body></html>`
  )
  await page.waitForFunction(() => document.images[0]?.complete)
  const png = await page.screenshot({
    clip: { x: 0, y: 0, width: SIZE, height: SIZE },
  })
  writeFileSync(join(DIR, `${style}-eye.png`), png)
  console.log(`${style}-eye.png: ${png.byteLength} bytes in ${DIR}`)
}
await browser.close()
