// THE REST POSE. MakeHuman's body stands with its arms angled down and its
// fingers curled; the export's bind is UAL's T-pose with UAL's own joint
// frames (export-format.md, "Rest pose"), so UAL clips play by name. This
// file works out, per joint, the rotation that carries the body from its own
// rest into the T-pose, and skins the meshes there by linear blend, once.
//
// How: walking the skeleton parent first, each limb bone (upper and lower
// arm, hand, fingers, thigh, calf) is turned by the shortest rotation that
// lays it along UAL's bone, after its parents have turned. The torso, neck
// and head are already UAL's column (tosijs-3d's HM08_UAL leans them so); the
// clavicles keep the body's own shoulder line; the feet are turned back to
// where they were, so they stay flat on the floor whatever the legs did.
// Then every joint takes UAL's frame as its rest rotation.

import type { Quat, Vec3 } from '../contracts/built-character'
import { UE_JOINTS } from '../contracts/profile'
import {
  add,
  IDENTITY,
  qconj,
  qmatrix,
  qmul,
  qnormalize,
  qrotate,
  sub,
} from './math'
import { qfromTo } from './math'
import { UAL_REST } from './ual-rest'

/** Each joint's parent index in UE_JOINTS order, -1 for root. */
export const PARENTS: readonly number[] = UE_JOINTS.map((j) =>
  UE_JOINTS.findIndex((k) => k.name === j.parent)
)

const index = (name: string): number => {
  const i = UE_JOINTS.findIndex((j) => j.name === name)
  if (i < 0) throw new Error(`not a profile joint: ${name}`)
  return i
}

/** UAL's rest, accumulated: each joint's model-space rotation and position. */
export interface GlobalRest {
  rotations: Quat[]
  positions: Vec3[]
}

/** UAL's own rest pose in model space (from `UAL_REST`). */
export function ualGlobalRest(): GlobalRest {
  const rotations: Quat[] = []
  const positions: Vec3[] = []
  UAL_REST.forEach(([name, t, r], i) => {
    if (name !== UE_JOINTS[i]!.name)
      throw new Error(`UAL_REST row ${i} is ${name}, not ${UE_JOINTS[i]!.name}`)
    const q = qnormalize([r[0], r[1], r[2], r[3]])
    const p = PARENTS[i]!
    if (p < 0) {
      rotations.push(q)
      positions.push([t[0], t[1], t[2]])
    } else {
      rotations.push(qnormalize(qmul(rotations[p]!, q)))
      positions.push(
        add(positions[p]!, qrotate(rotations[p]!, [t[0], t[1], t[2]]))
      )
    }
  })
  return { rotations, positions }
}

/** The limb bones laid along UAL's, and the child each aims at. */
const AIMED =
  /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky|thigh|calf)_/
/** Turned back to their own world orientation after the legs turned. */
const KEPT = /^(foot|ball)_/

function aimChild(i: number): number {
  const name = UE_JOINTS[i]!.name
  // A hand aims along its middle finger; any other joint at its one child.
  if (name.startsWith('hand_'))
    return index(name.replace('hand_', 'middle_01_'))
  return UE_JOINTS.findIndex((k) => k.parent === name)
}

/** How a body's skeleton goes from its own rest to the T-pose. */
export interface Repose {
  /** Per joint, the model-space rotation applied to everything it carries. */
  turn: Quat[]
  /** Per joint, where it is in the T-pose (the body's frame, not yet floored). */
  positions: Vec3[]
}

/**
 * The T-pose for a skeleton at `rest` (model-space joint positions, UE_JOINTS
 * order), aiming its limbs along `ual`'s bones.
 */
export function tPose(rest: readonly Vec3[], ual: GlobalRest): Repose {
  const turn: Quat[] = []
  const positions: Vec3[] = []
  for (let i = 0; i < UE_JOINTS.length; i++) {
    const p = PARENTS[i]!
    const parentTurn = p < 0 ? IDENTITY : turn[p]!
    positions.push(
      p < 0
        ? rest[i]!
        : add(positions[p]!, qrotate(parentTurn, sub(rest[i]!, rest[p]!)))
    )
    const name = UE_JOINTS[i]!.name
    let own: Quat = IDENTITY
    const c = aimChild(i)
    if (AIMED.test(name) && c >= 0) {
      const now = qrotate(parentTurn, sub(rest[c]!, rest[i]!))
      own = qfromTo(now, sub(ual.positions[c]!, ual.positions[i]!))
    } else if (KEPT.test(name)) {
      own = qconj(parentTurn)
    }
    turn.push(qnormalize(qmul(own, parentTurn)))
  }
  return { turn, positions }
}

/** No re-pose: the body's own rest (`restPose: 'source'`). */
export function sourcePose(rest: readonly Vec3[]): Repose {
  return {
    turn: rest.map(() => IDENTITY),
    positions: rest.map((p) => [...p] as Vec3),
  }
}

/** Skin influences, four per vertex: joint indices and weights. */
export interface Influences {
  joints: ArrayLike<number>
  weights: ArrayLike<number>
}

/**
 * Linear-blend skinning of `positions` (xyz) from `rest` joints to `pose`,
 * and the same blend's rotation applied to each of `vectors` (morph deltas:
 * a delta in the rest is that delta turned in the pose). New arrays.
 */
export function skinTo(
  positions: ArrayLike<number>,
  influences: Influences,
  rest: readonly Vec3[],
  pose: Repose,
  vectors: ReadonlyArray<ArrayLike<number>> = []
): { positions: Float32Array; vectors: Float32Array[] } {
  const n = positions.length / 3
  const out = new Float32Array(n * 3)
  const vout = vectors.map(() => new Float32Array(n * 3))
  const mats = pose.turn.map(qmatrix)
  const m = new Float64Array(9)
  for (let v = 0; v < n; v++) {
    m.fill(0)
    let x = 0
    let y = 0
    let z = 0
    const px = positions[v * 3]!
    const py = positions[v * 3 + 1]!
    const pz = positions[v * 3 + 2]!
    for (let k = 0; k < 4; k++) {
      const w = influences.weights[v * 4 + k]!
      if (w === 0) continue
      const j = influences.joints[v * 4 + k]!
      const r = mats[j]!
      const a = rest[j]!
      const b = pose.positions[j]!
      const dx = px - a[0]
      const dy = py - a[1]
      const dz = pz - a[2]
      x += w * (b[0] + r[0]! * dx + r[1]! * dy + r[2]! * dz)
      y += w * (b[1] + r[3]! * dx + r[4]! * dy + r[5]! * dz)
      z += w * (b[2] + r[6]! * dx + r[7]! * dy + r[8]! * dz)
      for (let e = 0; e < 9; e++) m[e]! += w * r[e]!
    }
    out[v * 3] = x
    out[v * 3 + 1] = y
    out[v * 3 + 2] = z
    vectors.forEach((d, t) => {
      const dx = d[v * 3]!
      const dy = d[v * 3 + 1]!
      const dz = d[v * 3 + 2]!
      if (dx === 0 && dy === 0 && dz === 0) return
      const o = vout[t]!
      o[v * 3] = m[0]! * dx + m[1]! * dy + m[2]! * dz
      o[v * 3 + 1] = m[3]! * dx + m[4]! * dy + m[5]! * dz
      o[v * 3 + 2] = m[6]! * dx + m[7]! * dy + m[8]! * dz
    })
  }
  return { positions: out, vectors: vout }
}
