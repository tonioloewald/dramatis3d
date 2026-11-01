import { expect, test } from 'bun:test'
import type { HumanPack } from 'tosijs-3d/human-pack'
import { bodyGeometry, morphedBodyGeometry } from './index'

const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
const triangles = new Uint32Array([0, 1, 2])

test('bodyGeometry builds an indexed geometry with normals', () => {
  const g = bodyGeometry(positions, triangles)
  expect(g.getAttribute('position').count).toBe(3)
  expect(Array.from(g.getIndex()!.array)).toEqual([0, 1, 2])
  const n = g.getAttribute('normal')
  // A triangle in the XY plane, wound counter-clockwise: +Z.
  expect([n.getX(0), n.getY(0), n.getZ(0)]).toEqual([0, 0, 1])
})

test('bodyGeometry copies its inputs', () => {
  const p = Float32Array.from(positions)
  const g = bodyGeometry(p, triangles)
  p[0] = 9
  expect(g.getAttribute('position').getX(0)).toBe(0)
})

test('morphedBodyGeometry with no targets is the base mesh', async () => {
  const pack = {
    positions,
    triangles,
    has: () => false,
  } as unknown as HumanPack
  const g = await morphedBodyGeometry(pack)
  expect(Array.from(g.getAttribute('position').array)).toEqual(
    Array.from(positions)
  )
})
