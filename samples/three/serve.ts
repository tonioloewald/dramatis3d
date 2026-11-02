// Serves the three.js sample: bun samples/three/serve.ts [--port 8062] [--host 0.0.0.0]
// It listens on localhost only unless --host says otherwise (it is a dev server).
// Bun bundles index.html and main.ts on request; the UAL clip is the gate-1
// fixture (CC0, test/gate1/fixtures/README.md).

import page from './index.html'

const flag = process.argv.indexOf('--port')
const port = flag > 0 ? Number(process.argv[flag + 1]) : 8062
const host = process.argv.indexOf('--host')
const hostname = host > 0 ? process.argv[host + 1] : '127.0.0.1'
const clip = new URL('../../test/gate1/fixtures/ual-walk.glb', import.meta.url)

const server = Bun.serve({
  port,
  hostname,
  development: true,
  routes: {
    '/': page,
    '/ual-walk.glb': () =>
      new Response(Bun.file(clip.pathname), {
        headers: { 'content-type': 'model/gltf-binary' },
      }),
  },
})
console.log(`three.js sample: ${server.url}`)
