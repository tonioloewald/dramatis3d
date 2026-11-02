import { describe, expect, test } from 'bun:test'
import type { Vec3 } from '../contracts/built-character'
import { UE_JOINT_NAMES, UE_JOINTS } from '../contracts/profile'
import { readGlb } from '../../test/gate1/glb'
import { qangle, qaxisAngle, qrotate, sub } from './math'
import { skinTo, sourcePose, tPose, ualGlobalRest } from './pose'
import { UAL_REST } from './ual-rest'

const at = (name: string): number => UE_JOINT_NAMES.indexOf(name)

describe("UAL's rest (ual-rest.ts)", () => {
  test('is the gate fixture armature, joint for joint', async () => {
    const path = new URL(
      '../../test/gate1/fixtures/ual-walk.glb',
      import.meta.url
    ).pathname
    const glb = readGlb(new Uint8Array(await Bun.file(path).arrayBuffer()))
    type Node = { name?: string; translation?: number[]; rotation?: number[] }
    const nodes = new Map<string, Node>(
      (glb.json.nodes as Node[]).map((n) => [n.name ?? '', n])
    )
    expect(UAL_REST.map((r) => r[0])).toEqual([...UE_JOINT_NAMES])
    for (const [name, t, r] of UAL_REST) {
      const n = nodes.get(name)!
      ;(n.translation ?? [0, 0, 0]).forEach((v, i) =>
        expect(Math.abs(v - t[i]!)).toBeLessThan(1e-8)
      )
      ;(n.rotation ?? [0, 0, 0, 1]).forEach((v, i) =>
        expect(Math.abs(v - r[i]!)).toBeLessThan(1e-8)
      )
    }
  })

  test('is a T-pose: the hands level with the shoulders, out along ±X', () => {
    const ual = ualGlobalRest()
    for (const s of ['l', 'r']) {
      const shoulder = ual.positions[at(`upperarm_${s}`)]!
      const hand = ual.positions[at(`hand_${s}`)]!
      expect(Math.abs(hand[1] - shoulder[1])).toBeLessThan(0.01)
      expect(Math.abs(hand[0])).toBeGreaterThan(0.7)
      expect(Math.sign(hand[0])).toBe(s === 'l' ? 1 : -1)
    }
    // Its bones run along each joint's local +Y.
    const upper = ual.rotations[at('upperarm_l')]!
    const dir = sub(
      ual.positions[at('lowerarm_l')]!,
      ual.positions[at('upperarm_l')]!
    )
    const y = qrotate(upper, [0, 1, 0])
    const l = Math.hypot(...dir)
    expect(y[0] * dir[0] + y[1] * dir[1] + y[2] * dir[2]).toBeCloseTo(l, 4)
  })
})

describe('tPose', () => {
  test("leaves UAL's own skeleton where it is", () => {
    const ual = ualGlobalRest()
    const pose = tPose(ual.positions, ual)
    pose.turn.forEach((q) => expect(qangle(q)).toBeLessThan(1e-4))
    pose.positions.forEach((p, i) =>
      p.forEach((v, k) =>
        expect(Math.abs(v - ual.positions[i]![k]!)).toBeLessThan(1e-6)
      )
    )
  })

  test("lays lowered arms along UAL's, keeps the feet's own orientation", () => {
    const ual = ualGlobalRest()
    // UAL's skeleton with each arm swung 50° down about the shoulder (Z).
    const rest = ual.positions.map((p) => [...p] as Vec3)
    for (const s of ['l', 'r'] as const) {
      const shoulder = ual.positions[at(`upperarm_${s}`)]!
      const turn = qaxisAngle(
        [0, 0, 1],
        ((s === 'l' ? -50 : 50) * Math.PI) / 180
      )
      UE_JOINTS.forEach((_, i) => {
        let j = i
        while (j >= 0 && UE_JOINT_NAMES[j] !== `upperarm_${s}`)
          j = UE_JOINT_NAMES.indexOf(UE_JOINTS[j]!.parent ?? '')
        if (j < 0) return
        const d = qrotate(turn, sub(ual.positions[i]!, shoulder))
        rest[i] = [shoulder[0] + d[0], shoulder[1] + d[1], shoulder[2] + d[2]]
      })
    }
    expect(rest[at('hand_l')]![1]).toBeLessThan(
      ual.positions[at('hand_l')]![1] - 0.3
    )
    const pose = tPose(rest, ual)
    // Within a millimetre: shortest-arc aiming leaves the arm's roll a
    // little off (the swing was not square to the bone), which the
    // fingertips show most.
    for (const name of [
      'hand_l',
      'hand_r',
      'middle_04_leaf_l',
      'thumb_04_leaf_r',
    ])
      pose.positions[at(name)]!.forEach((v, k) =>
        expect(Math.abs(v - ual.positions[at(name)]![k]!)).toBeLessThan(1e-3)
      )
    for (const name of ['foot_l', 'ball_r'])
      expect(qangle(pose.turn[at(name)]!)).toBeLessThan(1e-6)
  })
})

describe('skinTo', () => {
  test('moves a vertex with its joint, and turns its deltas', () => {
    const ual = ualGlobalRest()
    const rest = ual.positions
    const pose = sourcePose(rest)
    const hand = at('hand_l')
    pose.turn[hand] = qaxisAngle([0, 0, 1], Math.PI / 2)
    const v = rest[hand]!
    const positions = Float32Array.from([v[0] + 0.1, v[1], v[2]])
    const out = skinTo(
      positions,
      { joints: [hand, 0, 0, 0], weights: [1, 0, 0, 0] },
      rest,
      pose,
      [Float32Array.from([0.01, 0, 0])]
    )
    expect(out.positions[0]).toBeCloseTo(v[0], 5)
    expect(out.positions[1]).toBeCloseTo(v[1] + 0.1, 5)
    expect(out.vectors[0]![1]).toBeCloseTo(0.01, 6)
  })
})
