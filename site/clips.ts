// The starter clips: what the creator and the demo load to put a character in
// motion, cut from UAL1_core.glb by bin/make-ual-starter.ts and served from
// the site at STARTER_URL. CC0 (Quaternius' Universal Animation Library).

/** Where the starter clips are cut from: the CDN's UAL volume 1 core. */
export const STARTER_SOURCE =
  'https://cdn.tosijs.net/quaternius/UAL1_core.glb?v=2'

/** The creator's Motion menu, in its order. */
export const CREATOR_CLIPS = [
  'Idle_Loop',
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Dance_Loop',
  'Crouch_Fwd_Loop',
] as const

/**
 * The clips kept: the creator's, then what the demo's gaits add
 * (site/demo/core.ts GAITS; site/clips.test.ts checks both are here).
 */
export const STARTER_CLIPS = [...CREATOR_CLIPS, 'Sprint_Loop'] as const

/** The file on the site (site/static/clips/ual-starter.glb). */
export const STARTER_URL = '/clips/ual-starter.glb'
