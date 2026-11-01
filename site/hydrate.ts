// Hydration bundle entry, loaded by every generated page. Registers the doc
// system and seeds the modules live examples may `import`.
//
// The site is the creator's home, so it runs on tosijs-3d (Babylon). That is
// fine here and only here: the library entries (src/index.ts, src/three/) are
// held Babylon-free by src/no-babylon.test.ts.

import 'tosijs-ui' // the tosi-* element family
// Since tosijs-ui 1.15 the doc-authoring elements are opt-in subpaths; without
// them the site renders its prerendered markup and nothing else.
import 'tosijs-ui/doc-browser'
import 'tosijs-ui/live-example'
import * as tosijs from 'tosijs'
import * as tosijsui from 'tosijs-ui'
import * as dramatis from '../src/index'
// <dramatis-creator>: light; it loads the creator's own bundle when it mounts.
import './creator/element'

// <tosi-doc-system> reads .context in render(), after its docs.json fetch, so a
// synchronous assignment here lands in time.
for (const el of document.querySelectorAll('tosi-doc-system')) {
  ;(el as unknown as { context: Record<string, unknown> }).context = {
    tosijs,
    'tosijs-ui': tosijsui,
    dramatis,
  }
}
