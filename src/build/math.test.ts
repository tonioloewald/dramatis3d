import { describe, expect, test } from 'bun:test'
import type { Quat, Vec3 } from '../contracts/built-character'
import {
  inverseRigid,
  qangle,
  qaxisAngle,
  qconj,
  qfromTo,
  qmul,
  qrotate,
} from './math'

const close = (a: ArrayLike<number>, b: ArrayLike<number>, eps = 1e-6) => {
  expect(a.length).toBe(b.length)
  for (let i = 0; i < a.length; i++)
    expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(eps)
}

describe('quaternions', () => {
  test('a quarter turn about Y takes +X to -Z', () => {
    close(qrotate(qaxisAngle([0, 1, 0], Math.PI / 2), [1, 0, 0]), [0, 0, -1])
  })

  test('qfromTo takes one direction to the other, by the shortest turn', () => {
    const cases: Array<[Vec3, Vec3]> = [
      [
        [1, 0, 0],
        [0, 1, 0],
      ],
      [
        [0.2, -1, 0.3],
        [1, 0.1, -0.2],
      ],
      [
        [1, 0, 0],
        [-1, 0, 0],
      ],
      [
        [0, 0, 2],
        [0, 0, 5],
      ],
    ]
    for (const [a, b] of cases) {
      const q = qfromTo(a, b)
      const r = qrotate(q, a)
      const l = Math.hypot(...b) / Math.hypot(...a)
      close(
        r.map((x) => x * l),
        b
      )
      const dot =
        (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) /
        (Math.hypot(...a) * Math.hypot(...b))
      expect(qangle(q)).toBeCloseTo(Math.acos(Math.max(-1, dot)), 5)
    }
  })

  test('qmul composes right to left, qconj undoes', () => {
    const a = qaxisAngle([0, 0, 1], 0.7)
    const b = qaxisAngle([1, 0, 0], -0.4)
    const v: Vec3 = [0.3, -0.2, 0.9]
    close(qrotate(qmul(a, b), v), qrotate(a, qrotate(b, v)))
    close(qrotate(qmul(qconj(a), a), v), v)
  })
})

describe('inverseRigid', () => {
  test('is the inverse of rotate-then-move, column-major', () => {
    const q: Quat = qaxisAngle(
      [0.48, 0.6, 0.64].map((x) => x / Math.hypot(0.48, 0.6, 0.64)) as Vec3,
      1.1
    )
    const t: Vec3 = [0.4, 1.2, -0.3]
    const m = inverseRigid(q, t)
    const p: Vec3 = [0.1, -0.5, 0.25]
    const world = qrotate(q, p).map((x, i) => x + t[i]!)
    // m · world (column-major) = p
    const out = [0, 1, 2].map(
      (r) =>
        m[r]! * world[0]! +
        m[4 + r]! * world[1]! +
        m[8 + r]! * world[2]! +
        m[12 + r]!
    )
    close(out, p, 1e-6)
    expect([m[3], m[7], m[11], m[15]]).toEqual([0, 0, 0, 1])
  })
})
