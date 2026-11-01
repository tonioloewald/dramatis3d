/** The lanes that implement the contracts (LANES.md). */
export type Lane =
  | 'skinned-glb'
  | 'three'
  | 'share-licence'
  | 'site-creator'
  | 'extremes'
  | 'three-viewer'
  | 'engines'
  | 'vrm'

/**
 * What a contract stub throws until its lane implements it:
 * `Error("not implemented: <lane>")`. Every lane compiles against the
 * signature from the start; a call that reaches a stub fails loudly.
 */
export function notImplemented(lane: Lane): never {
  throw new Error(`not implemented: ${lane}`)
}
