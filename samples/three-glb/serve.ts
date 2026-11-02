// Serves the GLB sample: bun samples/three-glb/serve.ts [--port 8041] [--glb <path>]
// Bun bundles index.html and main.ts on request. The character is a sample
// export from samples/out/ unless --glb names another; the clip is the
// gate-1 fixture, UAL's Walk_Loop (CC0, test/gate1/fixtures/README.md).

import page from './index.html'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const port = Number(arg('--port') ?? 8041)
const glb =
  arg('--glb') ?? new URL('../out/clothed-casual.glb', import.meta.url).pathname
const clip = new URL('../../test/gate1/fixtures/ual-walk.glb', import.meta.url)
  .pathname

const binary = (path: string) => () =>
  new Response(Bun.file(path), {
    headers: { 'content-type': 'model/gltf-binary' },
  })

const server = Bun.serve({
  port,
  development: true,
  routes: {
    '/': page,
    '/character.glb': binary(glb),
    '/ual-walk.glb': binary(clip),
  },
})
console.log(`three.js GLB sample: ${server.url} (character: ${glb})`)
