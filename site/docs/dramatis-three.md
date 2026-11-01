# dramatis/three

<!--{"parent": "docs", "order": 2}-->

The three.js embed. It gives a three.js scene the same body maths the creator
uses, through tosijs-3d's engine-free subpaths, and never imports Babylon
(`src/no-babylon.test.ts` fails the build if it does, in the bundle or in the
emitted types).

`three` is a peer dependency: bring your own.

```ts
import { loadHumanPack } from 'tosijs-3d/human-pack'
import { DEFAULT_HUMAN_BODY, morphedBodyGeometry } from 'dramatis/three'

const pack = await loadHumanPack(packUrl)
const geometry = await morphedBodyGeometry(pack, {
  ...DEFAULT_HUMAN_BODY,
  muscle: 0.8,
})
scene.add(new Mesh(geometry, new MeshStandardMaterial()))
```

This is the start of the embed (spike 4 in PLAN.md): an unrigged, morphed body.
Skinning, garments and the face come next.
