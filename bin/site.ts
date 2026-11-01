// Site entry: a thin wrapper over tosijs-ui/site's doc-site pipeline (the same
// shape as tosijs-3d's bin/site.ts). Everything declarative is in site/config.ts.
//
//   bun bin/site.ts            build the site, then serve it with live rebuilds
//   bun bin/site.ts --build    build the site and the library, then exit (0/1)
//   bun bin/site.ts --stop     stop THIS project's dev server, and nothing else

import { buildSite, currentHolder, devServer } from 'tosijs-ui/site'
import config from '../site/config'

if (process.argv.includes('--stop')) {
  // Identified by tosijs-ui's build lock (pid per project root), never by a
  // pattern like `pkill -f 'bun bin/site.ts'`, which kills every sibling
  // project's dev server too.
  const holder = currentHolder('.')
  if (!holder) {
    console.log('No dev server running for this project.')
    process.exit(0)
  }
  process.kill(holder.pid, 'SIGTERM')
  console.log(`Stopped ${holder.role} for ${holder.root} (pid ${holder.pid}).`)
  process.exit(0)
}

const ok = await buildSite(config)
if (!ok) process.exit(1)
if (process.argv.includes('--build')) process.exit(0)

await devServer(config)
