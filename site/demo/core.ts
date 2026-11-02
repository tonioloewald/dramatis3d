// The demo's movement, apart from the page: how input becomes a heading and a
// speed, which clip a speed plays, and how the walker keeps out of the props.
// No DOM and no three.js, so Bun's tests run it (site/demo/demo.test.ts).
//
// UAL's loops are in place (the hips don't travel), so the demo moves the
// character itself and plays the clip whose stride matches the speed.

/** A point or direction on the ground: x, and z (three.js's ground axes). */
export interface Flat {
  x: number
  z: number
}

/** The clips the demo plays, slowest first, from UAL volume 1's core. */
export const GAITS = [
  { name: 'idle', clip: 'Idle_Loop', speed: 0 },
  { name: 'walk', clip: 'Walk_Loop', speed: 1.4 },
  { name: 'jog', clip: 'Jog_Fwd_Loop', speed: 3.4 },
  { name: 'sprint', clip: 'Sprint_Loop', speed: 6 },
] as const

export type Gait = (typeof GAITS)[number]['name']

/** The clip for a speed (m/s): the gait whose speed is nearest. */
export function gaitFor(speed: number): (typeof GAITS)[number] {
  let best: (typeof GAITS)[number] = GAITS[0]
  for (const g of GAITS)
    if (Math.abs(g.speed - speed) < Math.abs(best.speed - speed)) best = g
  return best
}

/** Which keys are down, as an intent: forward/back and right/left in -1..1. */
export interface Keys {
  forward: number
  right: number
  run: boolean
}

/** The keys a key event's `code` drives (WASD and the arrows). */
export const KEY_CODES: Record<string, keyof Omit<Keys, 'run'> | 'run'> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'forward',
  ArrowDown: 'forward',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyA: 'right',
  ArrowLeft: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
}

/** The sign a key gives its axis: S, Down, A and Left are negative. */
export function keySign(code: string): number {
  return /KeyS|ArrowDown|KeyA|ArrowLeft/.test(code) ? -1 : 1
}

/**
 * The direction to move on the ground, from the keys and the camera's yaw
 * (the angle of the camera's forward direction round Y, from +Z). Unit
 * length, or null when no direction is held.
 */
export function steer(keys: Keys, cameraYaw: number): Flat | null {
  const { forward: f, right: r } = keys
  if (f === 0 && r === 0) return null
  // Camera forward is (sin yaw, cos yaw); its right is (-cos yaw, sin yaw)
  // seen from above with +X to the left of +Z, as three.js's ground is.
  const s = Math.sin(cameraYaw)
  const c = Math.cos(cameraYaw)
  const x = f * s - r * c
  const z = f * c + r * s
  const len = Math.hypot(x, z)
  return { x: x / len, z: z / len }
}

/** The heading (yaw round Y, from +Z) that faces along a direction. */
export function headingOf(dir: Flat): number {
  return Math.atan2(dir.x, dir.z)
}

/** Turn from `current` toward `target` by at most `maxStep` radians, the short way. */
export function turnToward(
  current: number,
  target: number,
  maxStep: number
): number {
  let d = target - current
  d = Math.atan2(Math.sin(d), Math.cos(d))
  if (Math.abs(d) <= maxStep) return current + d
  return current + Math.sign(d) * maxStep
}

/** Where a clicked destination leads: a unit direction, or null on arrival. */
export function towardGoal(at: Flat, goal: Flat, arrive = 0.15): Flat | null {
  const x = goal.x - at.x
  const z = goal.z - at.z
  const len = Math.hypot(x, z)
  return len <= arrive ? null : { x: x / len, z: z / len }
}

/** A round obstacle on the ground. */
export interface Pillar extends Flat {
  r: number
}

/**
 * Keep a walker of radius `r` out of the pillars and inside a square arena of
 * half-size `half`: pushed out to the nearest surface, never through.
 */
export function collide(
  at: Flat,
  r: number,
  pillars: readonly Pillar[],
  half: number
): Flat {
  let { x, z } = at
  for (const p of pillars) {
    const dx = x - p.x
    const dz = z - p.z
    const d = Math.hypot(dx, dz)
    const min = p.r + r
    if (d >= min) continue
    if (d < 1e-6) {
      x = p.x + min
      continue
    }
    x = p.x + (dx / d) * min
    z = p.z + (dz / d) * min
  }
  const edge = half - r
  return {
    x: Math.max(-edge, Math.min(edge, x)),
    z: Math.max(-edge, Math.min(edge, z)),
  }
}

/** The demo's props: a ring of pillars, for scale and something to walk round. */
export function pillarRing(count = 8, radius = 7): Pillar[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + Math.PI / count
    return {
      x: Math.sin(a) * radius,
      z: Math.cos(a) * radius,
      r: 0.35 + (i % 3) * 0.15,
    }
  })
}

/** What the page offers to load, from the browser's saves. */
export interface SaveChoice {
  /** The store key. */
  key: string
  /** What the menu says. */
  label: string
}

/**
 * The saves as menu entries: the creator's working figure first (under the
 * store's reserved key), then the named ones in the store's order.
 */
export function saveChoices(
  names: readonly string[],
  hasWorking: boolean,
  working: string
): SaveChoice[] {
  return [
    ...(hasWorking
      ? [{ key: working, label: 'the figure in the creator' }]
      : []),
    ...names.filter((n) => n !== working).map((n) => ({ key: n, label: n })),
  ]
}

/** What a picked or dropped file is, by its name. */
export function fileKind(name: string): 'glb' | 'gltf' | 'character' | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.glb') || lower.endsWith('.vrm')) return 'glb'
  if (lower.endsWith('.gltf')) return 'gltf'
  if (lower.endsWith('.json')) return 'character'
  return null
}
