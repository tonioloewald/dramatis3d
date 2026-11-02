import { describe, expect, test } from 'bun:test'
import {
  clipProblems,
  licenceProblems,
  morphProblems,
  skeletonProblems,
  threeProblems,
  validatorErrors,
} from './checks'
import { clipBytes, makeFixture } from './fixture'
import { readGlb, writeGlb } from 'tosijs-3d/glb-chunks'

/*
EVERY GATE-1 CHECK CAN FAIL. The good fixture (a tiny export to the profile)
passes all six; each bad fixture breaks one thing and the check for that
thing must report it. A check that passes everything is worse than none.
*/

describe('gate 1 positive control: the good fixture passes every check', () => {
  test('validator: zero errors', async () => {
    expect(await validatorErrors(await makeFixture())).toEqual([])
  })
  test('skeleton: the profile joints', async () => {
    expect(skeletonProblems(readGlb(await makeFixture()))).toEqual([])
  })
  test('skeleton: the profile joints, Mixamo naming', async () => {
    const bytes = await makeFixture({ naming: 'mixamo' })
    expect(skeletonProblems(readGlb(bytes))).toEqual([])
  })
  test('morph targets: named per the profile', async () => {
    expect(morphProblems(readGlb(await makeFixture()))).toEqual([])
  })
  test('licences: in asset.extras', async () => {
    expect(licenceProblems(readGlb(await makeFixture()))).toEqual([])
  })
  test('three.js: GLTFLoader loads it under bun', async () => {
    expect(await threeProblems(await makeFixture())).toEqual([])
  })
  test('UAL clip: binds to the major joints and moves them', async () => {
    expect(await clipProblems(await makeFixture(), await clipBytes())).toEqual(
      []
    )
  })
  test('UAL clip: binds under Mixamo naming too', async () => {
    const bytes = await makeFixture({ naming: 'mixamo' })
    expect(await clipProblems(bytes, await clipBytes())).toEqual([])
  })
})

describe('gate 1 negative controls: each check fails on its bad fixture', () => {
  test('validator: an accessor past the end of its buffer view', async () => {
    const bytes = await makeFixture({
      mutate: (g) => {
        g.json.accessors[0].count += 1000
      },
    })
    const errors = await validatorErrors(bytes)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join('\n')).toContain('ACCESSOR_TOO_LONG')
  })

  test('skeleton: a renamed joint and a wrong parent', async () => {
    const bytes = await makeFixture({
      mutate: (g) => {
        const hand = g.json.nodes.find(
          (n: { name: string }) => n.name === 'hand_l'
        )
        hand.name = 'Hand_L'
      },
    })
    const problems = skeletonProblems(readGlb(bytes))
    expect(problems).toContain('missing joint hand_l')
    expect(problems).toContain('joint not in the profile: Hand_L')
  })

  test('skeleton: UE names in a file that declares Mixamo', async () => {
    const bytes = await makeFixture({
      mutate: (g) => {
        g.json.asset.extras.dramatis.naming = 'mixamo'
      },
    })
    expect(skeletonProblems(readGlb(bytes))).toContain(
      'missing joint mixamorig:Hips'
    )
  })

  test('morph targets: a target that is not a face unit, and none named', async () => {
    const renamed = await makeFixture({
      mutate: (g) => {
        g.json.meshes[0].extras.targetNames = ['Smile', 'JawDrop']
      },
    })
    expect(morphProblems(readGlb(renamed)).join('\n')).toContain(
      'target Smile is not a face unit'
    )
    const unnamed = await makeFixture({
      mutate: (g) => {
        delete g.json.meshes[0].extras
      },
    })
    expect(morphProblems(readGlb(unnamed)).join('\n')).toContain(
      'no extras.targetNames'
    )
  })

  test('licences: no extras, and an empty licence list', async () => {
    const none = await makeFixture({
      mutate: (g) => {
        delete g.json.asset.extras
      },
    })
    expect(licenceProblems(readGlb(none)).length).toBeGreaterThan(0)
    const empty = await makeFixture({
      mutate: (g) => {
        g.json.asset.extras.dramatis.licences = []
      },
    })
    expect(licenceProblems(readGlb(empty))).toContain(
      'licences is missing or empty'
    )
  })

  test('three.js: a file GLTFLoader refuses (glTF 1.0)', async () => {
    const bytes = await makeFixture({
      mutate: (g) => {
        g.json.asset.version = '1.0'
      },
    })
    const problems = await threeProblems(bytes)
    expect(problems.join('\n')).toContain('GLTFLoader failed')
  })

  test('three.js: a file with no skinned mesh', async () => {
    const bytes = await makeFixture({
      mutate: (g) => {
        const body = g.json.nodes.find(
          (n: { name: string }) => n.name === 'body'
        )
        delete body.skin
      },
    })
    expect(await threeProblems(bytes)).toContain(
      'GLTFLoader gave no SkinnedMesh'
    )
  })

  test('UAL clip: joints the clip cannot find by name', async () => {
    const bytes = await makeFixture({
      mutate: (g) => {
        for (const n of g.json.nodes) n.name = String(n.name).toUpperCase()
      },
    })
    const problems = await clipProblems(bytes, await clipBytes())
    expect(problems.join('\n')).toContain('pelvis: no node named pelvis')
  })

  test('UAL clip: a skeleton that is not the skinned one', async () => {
    // The joints are named right but the skin lists only `root`: three makes
    // the rest plain nodes, so the clip moves nothing the mesh follows.
    const bytes = await makeFixture({
      mutate: (g) => {
        g.json.skins[0].joints = [0]
        g.json.accessors[g.json.skins[0].inverseBindMatrices].count = 1
      },
    })
    const problems = await clipProblems(bytes, await clipBytes())
    expect(problems.join('\n')).toContain('is not a bone of the skinned mesh')
  })

  test('UAL clip: a clip with no tracks', async () => {
    const clip = readGlb(await clipBytes())
    clip.json.animations[0].channels = []
    const problems = await clipProblems(
      await makeFixture(),
      writeGlb(clip.json, clip.bin)
    )
    expect(problems.join('\n')).toContain('the clip has no track for it')
  })

  test('UAL clip: a clip frozen at the rest pose binds but moves nothing', async () => {
    // Every rotation and translation key overwritten with the joint's rest
    // value (the fixture's rest is UAL's), so the tracks bind and do nothing.
    const clip = readGlb(await clipBytes())
    const j = clip.json
    const bin = clip.bin!
    for (const c of j.animations[0].channels) {
      const node = j.nodes[c.target.node]
      const rest =
        c.target.path === 'rotation'
          ? node.rotation ?? [0, 0, 0, 1]
          : c.target.path === 'translation'
          ? node.translation ?? [0, 0, 0]
          : node.scale ?? [1, 1, 1]
      const out = j.accessors[j.animations[0].samplers[c.sampler].output]
      const view = j.bufferViews[out.bufferView]
      const floats = new Float32Array(
        bin.buffer,
        bin.byteOffset + view.byteOffset + (out.byteOffset ?? 0),
        out.count * rest.length
      )
      for (let k = 0; k < floats.length; k++) floats[k] = rest[k % rest.length]
    }
    const problems = await clipProblems(await makeFixture(), writeGlb(j, bin))
    const text = problems.join('\n')
    expect(text).toContain('upperarm_l: the clip does not turn it')
    expect(text).toContain('hand_l: travels 0.0 cm')
  })
})
