# Babylon.js

<!--{"parent": "docs", "order": 12, "description": "Load a Dramatis GLB into your own Babylon.js scene with @babylonjs/loaders, set face units and play UAL clips by bone name. Verified headless with Babylon.js 9.33."}-->

**Verified** with Babylon.js 9.33 on every sample export (spike 1,
`reports/spike-1.md`), headless: on a `NullEngine` under Bun, so nothing was
rendered. Skinning was checked by computing it on the CPU from Babylon's own
bone matrices.

Babylon's own glTF loader (`@babylonjs/loaders`) reads a Dramatis export
as is: one skeleton of 65 bones, every mesh skinned to it, the face units
as morph targets, PBR materials, and a third-party clip moving the bones
and the skin.

(The creator itself runs on Babylon through tosijs-3d. This page is about
loading an *exported* character into your own Babylon scene.)

## Load

```ts
import '@babylonjs/loaders/glTF'
import { SceneLoader } from '@babylonjs/core'

const { meshes, skeletons } = await SceneLoader.ImportMeshAsync(
  '', '/characters/', 'hero.glb', scene
)
const skeleton = skeletons[0]                      // 65 bones
const body = scene.getMeshByName('body')!
```

- Bone names are kept exactly, Mixamo's `mixamorig:Hips` included.
- Babylon is left-handed: the loader puts everything under a `__root__`
  node that converts from glTF's right-handed axes. Leave `__root__` alone
  and move the character by parenting `__root__` to your own node.

## Facial expressions

The 59 face units are morph targets, named as in the
[export format](/export-format/). One unit can live on several meshes (the
body, teeth and tongue all carry `JawDrop`): set them together.

```ts
function setUnit(unit: string, value: number) {
  for (const m of meshes) {
    const t = m.morphTargetManager?.getTargetByName(unit)
    if (t) t.influence = value
  }
}
```

## Playing UAL animations

The skeleton has UAL's rest frames, so UAL's clips play by bone name. Load
UAL's file into the same scene, then clone its animation group onto your
character's bones. The glTF loader animates the transform node linked to
each bone, so map to `bone.getTransformNode()`. Keep rotations for every
bone and positions for `root` and `pelvis` only:

```ts
const ual = await SceneLoader.ImportMeshAsync('', '/anims/', 'UAL1.glb', scene)
const source = ual.animationGroups.find((g) => g.name === 'Walk_Loop')!
const byName = new Map(skeleton.bones.map((b) => [b.name, b]))
const walk = source.clone('walk', (old) =>
  byName.get(old.name)?.getTransformNode() ?? null
)
for (const ta of [...walk.targetedAnimations]) {
  const keep =
    ta.animation.targetProperty === 'rotationQuaternion' ||
    ['root', 'pelvis'].includes(ta.target?.name)
  if (!ta.target || !keep) walk.removeTargetedAnimation(ta.animation)
}
walk.start(true)
ual.meshes.forEach((m) => m.dispose())           // UAL's own mannequin
```

UAL's pelvis keys hold the mannequin's hip height. On a much taller or
shorter character, scale the pelvis position keys by the ratio of the hips'
heights or the feet will float or sink (on the 2.2 m sample the head
travels 55 cm during the walk unscaled, 11 cm scaled: the body sinks to
the mannequin's hip height).

For clips made on other skeletons, tosijs-3d's `retarget-babylon` module
retargets by bone map.

## Materials

Every mesh gets a `PBRMaterial`. Hair, brows and teeth are alpha-tested
(glTF `MASK`). The creator's skin scattering does not travel.
