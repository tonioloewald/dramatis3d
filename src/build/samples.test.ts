// The committed exports in samples/out/ (gate 1's input), checked beyond
// what gate 1 asks: the bind is consistent, the rest is UAL's T-pose with
// UAL's frames, the root is at the origin, the meshes are the profile's.
// Offline: it reads the files, never the CDN (build.network.test.ts does).

import { describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SkinnedMesh, Vector3 } from 'three'
import { loadWithThree } from '../../test/gate1/checks'
import { readGlb } from '../../test/gate1/glb'
import {
  EXTRAS_KEY,
  jointName,
  type NamingProfile,
  UE_JOINT_NAMES,
} from '../contracts/profile'
import { UAL_REST } from './ual-rest'

const OUT = join(import.meta.dir, '..', '..', 'samples', 'out')
const files = readdirSync(OUT).filter((f) => f.endsWith('.glb'))

const ORDER = [
  'body',
  'eyes',
  'eyelashes',
  'teeth',
  'tongue',
  'brows',
  'beard',
  'hair',
  'garment',
]

test('there are at least three samples', () => {
  expect(files.length).toBeGreaterThanOrEqual(3)
})

for (const file of files) {
  describe(`samples/out/${file}`, () => {
    const bytes = async (): Promise<Uint8Array> =>
      new Uint8Array(await Bun.file(join(OUT, file)).arrayBuffer())

    test('each skinned vertex sits where it is drawn at rest (the bind is consistent)', async () => {
      const gltf = await loadWithThree(await bytes())
      gltf.scene.updateMatrixWorld(true)
      let worst = 0
      gltf.scene.traverse((o) => {
        if (!(o instanceof SkinnedMesh)) return
        o.skeleton.update()
        const pos = o.geometry.getAttribute('position')
        const v = new Vector3()
        const r = new Vector3()
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i)
          r.copy(v)
          o.applyBoneTransform(i, v)
          worst = Math.max(worst, v.distanceTo(r))
        }
      })
      expect(worst).toBeLessThan(1e-5)
    })

    test("the rest is UAL's: its frames, a T-pose, the root at the origin", async () => {
      const { json } = readGlb(await bytes())
      const extras = json.asset.extras[EXTRAS_KEY]
      const naming = extras.naming as NamingProfile
      expect(extras.restPose).toBe('t-pose')
      const byName = new Map<
        string,
        { translation: number[]; rotation: number[] }
      >(json.nodes.map((n: { name: string }) => [n.name, n]))
      for (const [ue, , r] of UAL_REST) {
        const node = byName.get(jointName(ue, naming))!
        node.rotation.forEach((v, i) =>
          expect(Math.abs(v - r[i]!)).toBeLessThan(1e-5)
        )
      }
      expect(byName.get('root')!.translation).toEqual([0, 0, 0])
      const gltf = await loadWithThree(await bytes())
      gltf.scene.updateMatrixWorld(true)
      const world = (ue: string): Vector3 =>
        gltf.scene
          .getObjectByName(jointName(ue, naming).replace(':', ''))!
          .getWorldPosition(new Vector3())
      for (const s of ['l', 'r']) {
        const shoulder = world(`upperarm_${s}`)
        const hand = world(`hand_${s}`)
        expect(Math.abs(hand.y - shoulder.y)).toBeLessThan(0.01)
        expect(Math.abs(hand.x - shoulder.x)).toBeGreaterThan(0.4)
      }
      expect(world('pelvis').y).toBeGreaterThan(0.7)
    })

    test("the meshes are the profile's, in its order, materials named for them", async () => {
      const { json } = readGlb(await bytes())
      const names: string[] = json.meshes.map((m: { name: string }) => m.name)
      const rank = (n: string): number =>
        n === 'moustache'
          ? ORDER.indexOf('beard') + 0.5
          : ORDER.indexOf(n.startsWith('garment_') ? 'garment' : n)
      // body first; every name ASCII letters, digits and _.
      expect(names[0]).toBe('body')
      for (const n of names) expect(n).toMatch(/^[A-Za-z0-9_]+$/)
      json.meshes.forEach(
        (
          m: {
            primitives: Array<{
              material: number
              attributes: Record<string, number>
            }>
          },
          i: number
        ) => {
          const p = m.primitives[0]!
          expect(json.materials[p.material].name).toBe(names[i])
          expect(Object.keys(p.attributes).sort()).toEqual(
            expect.arrayContaining([
              'JOINTS_0',
              'NORMAL',
              'POSITION',
              'WEIGHTS_0',
            ])
          )
        }
      )
      const ranks = names.map(rank)
      expect(ranks.every((r) => r >= 0)).toBe(true)
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
      const garments = names.filter((n) => n.startsWith('garment_'))
      expect([...garments].sort()).toEqual(garments)
      const nodes = json.nodes.filter(
        (n: { mesh?: number }) => n.mesh !== undefined
      )
      for (const n of nodes) {
        expect(n.translation ?? null).toBeNull()
        expect(n.rotation ?? null).toBeNull()
        expect(n.skin).toBe(0)
      }
      expect(json.skins[0].name).toBe('skeleton')
      expect(
        json.skins[0].joints.map((j: number) => json.nodes[j].name)
      ).toEqual(
        UE_JOINT_NAMES.map((n) =>
          jointName(n, json.asset.extras[EXTRAS_KEY].naming)
        )
      )
    })

    test('the licences are in asset.copyright too', async () => {
      const { json } = readGlb(await bytes())
      const licences = json.asset.extras[EXTRAS_KEY].licences as Array<{
        title: string
        licence: string
      }>
      for (const e of licences)
        expect(json.asset.copyright).toContain(`${e.title}: ${e.licence}`)
      expect(licences[0]).toMatchObject({ kind: 'base', licence: 'CC0-1.0' })
    })
  })
}
