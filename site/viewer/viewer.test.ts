// The viewer's logic on the real exports in samples/out/ (both namings), the
// UAL clip file it ships, and its own build: no Babylon in the bundle.

import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AnimationMixer, Vector3, type Object3D } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { fetchGlb, GLB_MAX_BYTES } from '../../src/contracts/handoff'
import { MAJOR_JOINTS, UE_JOINTS } from '../../src/contracts/profile'
import { BABYLON_MARKERS, buildViewer, WALK_CLIP } from './build'
import {
  describeModel,
  faceUnitNames,
  fitClip,
  foreignOrigin,
  guessNaming,
  licenceLine,
  loadTickets,
  setFaceUnit,
} from './core'

const OUT = join(import.meta.dir, '..', '..', 'samples', 'out')

async function load(path: string): Promise<GLTF> {
  const b = readFileSync(path)
  const buffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  return new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')
}

const walkFile = await load(WALK_CLIP)
const walk = walkFile.animations.find((a) => a.name === 'Walk_Loop')!

function world(root: Object3D, name: string): Vector3 {
  root.updateMatrixWorld(true)
  return root.getObjectByName(name)!.getWorldPosition(new Vector3())
}

const samples = [
  ['clothed-casual.glb', 'ue', 'hand_l'],
  ['clothed-casual-mixamo.glb', 'mixamo', 'mixamorigLeftHand'],
] as const

for (const [file, naming, hand] of samples) {
  const path = join(OUT, file)
  describe.skipIf(!existsSync(path))(`viewer on ${file}`, async () => {
    const gltf = await load(path)
    const model = describeModel(gltf, file)

    test('reads the Dramatis block and its naming', () => {
      expect(model.extrasProblems).toEqual([])
      expect(model.extras).not.toBeNull()
      expect(model.naming).toBe(naming)
      expect(guessNaming(model.bones)).toBe(naming)
      expect(model.bones.length).toBe(UE_JOINTS.length)
      expect(model.name.length).toBeGreaterThan(0)
    })

    test('Walk_Loop binds by name to every major joint and moves the hand', () => {
      const fit = fitClip(walk, model, gltf.scene, walkFile.scene)
      expect(fit.missing).toEqual([])
      expect(fit.ok).toBe(true)
      for (const ue of MAJOR_JOINTS) expect(fit.bound).toContain(ue)
      expect(fit.summary).toContain('no retargeting')
      if (naming === 'mixamo') expect(fit.summary).toContain('renamed')
      // A real body's hips are near UAL's mannequin's: the scale is sane.
      expect(fit.translationScale).toBeGreaterThan(0.7)
      expect(fit.translationScale).toBeLessThan(1.3)

      const mixer = new AnimationMixer(gltf.scene)
      mixer.clipAction(fit.clip).play()
      mixer.update(0)
      const a = world(gltf.scene, hand)
      mixer.update(0.4)
      const b = world(gltf.scene, hand)
      expect(a.distanceTo(b)).toBeGreaterThan(0.02)
      mixer.stopAllAction()
    })

    test('face units drive every mesh that has them', () => {
      const names = faceUnitNames(model)
      expect(names).toEqual(model.extras!.faceUnits)
      expect(names).toContain('JawDrop')
      const n = setFaceUnit(model, 'JawDrop', 0.5)
      expect(n).toBeGreaterThan(0)
      for (const mesh of model.faceUnits.get('JawDrop')!) {
        const i = mesh.morphTargetDictionary!.JawDrop!
        expect(mesh.morphTargetInfluences![i]).toBe(0.5)
      }
      expect(setFaceUnit(model, 'NoSuchUnit', 1)).toBe(0)
    })

    test('lists the licence of every asset, base first among them', () => {
      const entries = model.extras!.licences
      expect(entries.length).toBeGreaterThan(1)
      expect(entries.some((e) => e.kind === 'base')).toBe(true)
      for (const e of entries) {
        const line = licenceLine(e)
        expect(line).toContain(e.title)
        expect(line).toContain(e.licence)
        if (e.attribution) expect(line).toContain(e.attribution)
      }
    })
  })
}

describe('viewer on a file that is not a Dramatis export', () => {
  test('the UAL clip file: no extras, no skin, says so', () => {
    const model = describeModel(walkFile, 'ual-walk.glb')
    expect(model.extras).toBeNull()
    expect(model.extrasProblems[0]).toContain('not a Dramatis export')
    expect(model.copyright).toContain('CC0')
    expect(model.ownClips.map((c) => c.name)).toContain('Walk_Loop')
    expect(model.bones).toEqual([])
    const fit = fitClip(walk, model, walkFile.scene, walkFile.scene)
    expect(fit.ok).toBe(false)
    expect(fit.summary).toContain('no skinned skeleton')
  })

  test('a skeleton with other names: the clip is refused, naming the joints', async () => {
    const gltf = await load(join(OUT, 'clothed-casual.glb'))
    gltf.scene.traverse((o) => {
      if (o.name === 'hand_l') o.name = 'LeftWrist'
    })
    const model = describeModel(gltf, 'renamed.glb')
    const fit = fitClip(walk, model, gltf.scene, walkFile.scene)
    expect(fit.ok).toBe(false)
    expect(fit.missing).toEqual(['hand_l'])
    expect(fit.summary).toContain('retargeting')
  })
})

describe('licences the file states', () => {
  const withExtras = async (edit: (d: Record<string, unknown>) => void) => {
    const gltf = await load(join(OUT, 'clothed-casual.glb'))
    const asset = gltf.asset as { extras: Record<string, unknown> }
    const block = structuredClone(asset.extras.dramatis) as Record<
      string,
      unknown
    >
    edit(block)
    asset.extras = { ...asset.extras, dramatis: block }
    return describeModel(gltf, 'edited.glb')
  }

  test('a valid block: its entries', async () => {
    const model = await withExtras(() => {})
    expect(model.extras).not.toBeNull()
    expect(model.licences).toBe(model.extras!.licences)
  })

  test('a later version: invalid, and its entries are still listed', async () => {
    const valid = await withExtras(() => {})
    const model = await withExtras((d) => {
      d.version = 2
    })
    expect(model.extras).toBeNull()
    expect(model.extrasProblems[0]).toContain('version')
    expect(model.licences.map((l) => l.asset)).toEqual(
      valid.licences.map((l) => l.asset)
    )
  })

  test('an invalid block keeps only entries with every field', async () => {
    const model = await withExtras((d) => {
      d.faceUnits = ['NotAUnit']
      const list = d.licences as Record<string, unknown>[]
      list.push({ asset: 'x', title: 'no licence field' }, null as never)
    })
    expect(model.extras).toBeNull()
    expect(model.licences.some((l) => l.asset === 'x')).toBe(false)
    expect(model.licences.length).toBeGreaterThan(0)
  })

  test('a URL from another site is labelled with its origin', () => {
    const page = 'https://dramatis.tosijs.net/viewer/?glb=x'
    expect(foreignOrigin('https://evil.example/forged.glb', page)).toBe(
      'https://evil.example'
    )
    expect(foreignOrigin('/samples/clothed-casual.glb', page)).toBeNull()
    expect(foreignOrigin('data:model/gltf-binary;base64,AA==', page)).toBe(
      'a data: URL'
    )
    expect(foreignOrigin('https://dramatis.tosijs.net/a.glb', page)).toBeNull()
  })
})

describe('load tickets', () => {
  test('two overlapping loads, resolved out of order: only the later one lands', async () => {
    const next = loadTickets()
    const landed: string[] = []
    const load = async (name: string, ms: number) => {
      const live = next()
      await Bun.sleep(ms)
      if (live()) landed.push(name)
    }
    await Promise.all([load('slow ?glb= fetch', 30), load('dropped file', 5)])
    expect(landed).toEqual(['dropped file'])
  })
})

// The ?glb= door's hostile-input tests (src/contracts/doors.ts): the viewer,
// the demo and the Unity player fetch any URL they are given.
describe('hostile ?glb=', () => {
  const respond = (body: BodyInit, headers: Record<string, string> = {}) =>
    (async () => new Response(body, { headers })) as unknown as typeof fetch

  test('hostile ?glb=: oversize responses stop at the cap', async () => {
    // Declared too big: refused before reading.
    await expect(
      fetchGlb('x', {
        max: 1000,
        fetch: respond('', { 'content-length': '5000' }),
      })
    ).rejects.toThrow(/not opened/)
    // Undeclared, and endless: stopped once the cap is passed.
    let pulled = 0
    const endless = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled++
        c.enqueue(new Uint8Array(256))
      },
    })
    await expect(
      fetchGlb('x', { max: 1000, fetch: respond(endless) })
    ).rejects.toThrow(/not opened/)
    expect(pulled).toBeLessThan(10)
    // Under the cap, the bytes come through whole.
    const ok = await fetchGlb('x', {
      max: 1000,
      fetch: respond(new Uint8Array(600).fill(7)),
    })
    expect(ok.length).toBe(600)
    expect(GLB_MAX_BYTES).toBe(128 * 2 ** 20)
  })

  test('hostile ?glb=: malformed files are refused by the loader, or shown as any glTF', async () => {
    for (const junk of [
      new Uint8Array(0),
      new Uint8Array(64).fill(0xff),
      new TextEncoder().encode('glTF but not really'),
    ])
      await expect(
        new GLTFLoader().parseAsync(junk.buffer as ArrayBuffer, '')
      ).rejects.toBeDefined()
    const gltf = await load(join(OUT, 'clothed-casual.glb'))
    for (const extras of [
      'a string',
      42,
      [],
      { dramatis: [] },
      { dramatis: null },
    ]) {
      ;(gltf as unknown as { asset: Record<string, unknown> }).asset.extras =
        extras
      const model = describeModel(gltf, 'junk.glb')
      expect(model.extras).toBeNull()
      expect(model.licences).toEqual([])
    }
  })

  test('hostile ?glb=: prototype keys are data, and pollute nothing', async () => {
    const gltf = await load(join(OUT, 'clothed-casual.glb'))
    const asset = gltf.asset as unknown as { extras: Record<string, unknown> }
    const block = JSON.parse(
      JSON.stringify(asset.extras.dramatis).replace(
        '{',
        '{"__proto__":{"polluted":"yes","licences":[]},"constructor":{"prototype":{"polluted":"yes"}},'
      )
    )
    asset.extras = JSON.parse(
      '{"__proto__":{"dramatis":{"licences":[]}},"dramatis":' +
        JSON.stringify(block) +
        '}'
    )
    const model = describeModel(gltf, 'proto.glb')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(model.extras).not.toBeNull()
    expect(model.licences.length).toBeGreaterThan(1)
  })
})

describe('the viewer build', () => {
  test('bundles the page, the clip, and no Babylon', async () => {
    const out = mkdtempSync(join(tmpdir(), 'dramatis-viewer-'))
    expect(await buildViewer(out)).toBe(true)
    for (const f of ['index.html', 'main.js', 'ual-walk.glb'])
      expect(existsSync(join(out, f))).toBe(true)
    const js = readFileSync(join(out, 'main.js'), 'utf8')
    for (const m of BABYLON_MARKERS) expect(js.includes(m)).toBe(false)
    expect(js).toContain('dramatis-handoff')
  }, 60_000)
})
