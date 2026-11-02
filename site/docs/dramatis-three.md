# dramatis/three

<!--{"parent": "docs", "order": 2, "description": "The three.js embed (dramatis/three): a built character as live three.js objects, updated in place as sliders move, with UAL clips playing by name."}-->

The three.js embed. It turns a built character into three.js objects you add
to your scene, and keeps them live as the character changes. It never imports
Babylon: `src/no-babylon.test.ts` fails the build if it does, in the bundle or
in the emitted types.

`three` is a peer dependency: bring your own (0.160 or later). The package
is not on npm yet; in a checkout, import from `src/three/index.ts`.

This page is for building the character in your page. To load a GLB you
exported, read the [three.js guide](/guide-threejs/) instead.

## A character in a scene

```ts
import { buildCharacter } from 'dramatis'
import { characterObject } from 'dramatis/three'

const built = await buildCharacter(character, pack)
const c = characterObject(built)
scene.add(c.root)
c.setFaceUnit('JawDrop', 0.4)
```

`characterObject(built, { naming })` returns:

| field | what it is |
| --- | --- |
| `root` | a `Group` holding the root bone and the meshes. Add it to the scene. |
| `skeleton` | the one `Skeleton` every mesh is bound to: the profile's 65 joints in order. |
| `meshes` | one `SkinnedMesh` per built mesh (`body`, `eyes`, `garment_…`), in the built order. |
| `setFaceUnit(unit, weight)` | sets a face unit (0..1) on every mesh that carries it. |
| `dispose()` | frees geometries, materials and textures. |

It is the scene graph three's `GLTFLoader` gives for the exported GLB, made
directly: the same node and bone names (`naming: 'mixamo'` gives Mixamo's,
with `:` dropped as three does), the face units as morph targets named as in
the [export profile](/export-format/), and `MeshStandardMaterial`
(`MeshPhysicalMaterial` where a garment has sheen). Textures decode in the
background, so the call itself is synchronous.

## Live updates

When a slider moves, rebuild and update the object in place:

```ts
import { updateCharacterObject } from 'dramatis/three'

updateCharacterObject(c, await buildCharacter(changed, pack))
```

The root, the bones and the skeleton stay the same objects, so the scene and
an `AnimationMixer` keep working. Meshes with the same topology are rewritten
in place, others are remade, and face-unit weights carry over. Face units
need no rebuild at all: `setFaceUnit` is a morph weight.

## Playing animations

Characters are skinned in UAL's T-pose with UAL's joint frames, so Quaternius'
Universal Animation Library clips (CC0) play by name. `characterClip` keeps a
clip's rotations and only the hips' translation, so the clip doesn't stretch
the body to the mannequin's bone lengths:

```ts
import { characterClip } from 'dramatis/three'

const mixer = new AnimationMixer(c.root)
mixer
  .clipAction(characterClip(walk, { translationScale: hipHeightRatio }))
  .play()
```

## The sample

`samples/three/` is a plain three.js page (no framework) with live sliders,
orbit controls and a UAL walk: `bun samples/three/serve.ts`. It still shows
the adapter's hand-made stand-in character on UAL's skeleton
(`src/three/fixture-character.ts`), not a character from `buildCharacter`:
it was written before the builder landed and has not been moved over yet.
For a real export in three.js, `samples/three-glb/` (the
[three.js guide](/guide-threejs/)) loads one.

**Next step: a character controller.** Dramatis builds none. For
react-three-fiber, [ecctrl](https://github.com/pmndrs/ecctrl) takes any
`Object3D` as its character: pass `c.root` as its child and drive the mixer
from its animation state. That sample is not built yet.

## The body alone

For an unrigged body, `morphedBodyGeometry(pack, body)` gives the pack's base
mesh morphed by its macro targets, through tosijs-3d's engine-free subpaths:

```ts
import { loadHumanPack } from 'tosijs-3d/human-pack'
import { HM08_PACK_URL } from 'dramatis'
import { DEFAULT_HUMAN_BODY, morphedBodyGeometry } from 'dramatis/three'

const pack = await loadHumanPack(HM08_PACK_URL)
const geometry = await morphedBodyGeometry(pack, {
  ...DEFAULT_HUMAN_BODY,
  muscle: 0.8,
})
scene.add(new Mesh(geometry, new MeshStandardMaterial()))
```

## What you download

Installing `dramatis` (or `tosijs-3d`) also installs Babylon.js (about
16 MB of download) because tosijs-3d declares it as a peer, even though none
of it reaches your bundle. To skip it: `npm install --legacy-peer-deps` or
`bun install --omit=peer`. The measurements are in `reports/spike-4.md`.
