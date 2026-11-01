// The little rigid-body maths the build needs: quaternions (x, y, z, w, as
// glTF orders them) and the column-major matrices glTF stores. Pure.

import type { Quat, Vec3 } from '../contracts/built-character'

export const IDENTITY: Quat = [0, 0, 0, 1]

export function qmul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export function qconj(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]]
}

export function qnormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  // One hemisphere (w >= 0), so equal rotations write equal numbers.
  const s = q[3] < 0 ? -1 / l : 1 / l
  return [q[0] * s, q[1] * s, q[2] * s, q[3] * s]
}

/** `v` rotated by unit quaternion `q`. */
export function qrotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q
  // t = 2 (q.xyz × v); v' = v + w t + q.xyz × t
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ]
}

/** The shortest rotation taking direction `a` to direction `b`. */
export function qfromTo(a: Vec3, b: Vec3): Quat {
  const la = Math.hypot(...a) || 1
  const lb = Math.hypot(...b) || 1
  const u: Vec3 = [a[0] / la, a[1] / la, a[2] / la]
  const v: Vec3 = [b[0] / lb, b[1] / lb, b[2] / lb]
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  if (d < -0.999999) {
    // Opposite: half a turn about any axis perpendicular to `u`.
    const axis: Vec3 =
      Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0])
    const l = Math.hypot(...axis)
    return [axis[0] / l, axis[1] / l, axis[2] / l, 0]
  }
  const c = cross(u, v)
  return qnormalize([c[0], c[1], c[2], 1 + d])
}

/** The rotation by `angle` radians about unit `axis`. */
export function qaxisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2)
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
}

/** The angle of a rotation, radians, 0..π. */
export function qangle(q: Quat): number {
  return 2 * Math.acos(Math.min(1, Math.abs(q[3])))
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** A 3×3 rotation matrix from a unit quaternion, row-major. */
export function qmatrix(q: Quat): number[] {
  const [x, y, z, w] = q
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ]
}

/**
 * The inverse of the rigid transform (rotate by `q`, then move to `t`), as
 * glTF's column-major 4×4.
 */
export function inverseRigid(q: Quat, t: Vec3): Float32Array {
  // Inverse: R^T, -R^T t. Row-major R^T is column-major R.
  const r = qmatrix(q)
  const it: Vec3 = [
    -(r[0]! * t[0] + r[3]! * t[1] + r[6]! * t[2]),
    -(r[1]! * t[0] + r[4]! * t[1] + r[7]! * t[2]),
    -(r[2]! * t[0] + r[5]! * t[1] + r[8]! * t[2]),
  ]
  // Column-major M = R^T: M[i][c] = r[c*3+i], stored at c*4+i, so column c
  // is (r[c*3], r[c*3+1], r[c*3+2]).
  return Float32Array.from([
    r[0]!,
    r[1]!,
    r[2]!,
    0,
    r[3]!,
    r[4]!,
    r[5]!,
    0,
    r[6]!,
    r[7]!,
    r[8]!,
    0,
    it[0],
    it[1],
    it[2],
    1,
  ])
}
