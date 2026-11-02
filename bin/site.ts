// Site entry: a thin wrapper over tosijs-ui/site's doc-site pipeline (the same
// shape as tosijs-3d's bin/site.ts). Everything declarative is in site/config.ts.
//
//   bun bin/site.ts            build the site, then serve it with live rebuilds
//   bun bin/site.ts --build    build the site and the library, then exit (0/1)
//   bun bin/site.ts --stop     stop THIS project's dev server, and nothing else

import { rmSync } from 'node:fs'
import { buildSite, currentHolder, devServer } from 'tosijs-ui/site'
import config from '../site/config'
import { printSizes } from './sizes'
import { processCwd, stopDecision } from './stop'

if (process.argv.includes('--stop')) {
  // Identified by tosijs-ui's build lock (pid per project root), never by a
  // pattern like `pkill -f 'bun bin/site.ts'`, which kills every sibling
  // project's dev server too. The lock alone is not enough: see bin/stop.ts.
  const decision = stopDecision(currentHolder('.'), processCwd)
  if (decision.action === 'none') {
    console.log('No dev server running for this project.')
    process.exit(0)
  }
  if (decision.action === 'refuse') {
    console.error(decision.message)
    process.exit(1)
  }
  process.kill(decision.pid, 'SIGTERM')
  console.log(decision.message)
  process.exit(0)
}

const building = process.argv.includes('--build')
// The library build writes into dist/ without clearing it, so an old hashed chunk
// would ride along into the tarball. A full build starts from an empty dist/.
if (building) rmSync('dist', { recursive: true, force: true })

const ok = await buildSite(config)
if (!ok) process.exit(1)
if (building) {
  printSizes()
  process.exit(0)
}

await devServer(config)
