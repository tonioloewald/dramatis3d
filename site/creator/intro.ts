// The creator's intro: what Dramatis is, shown once on a first visit and again
// from the Dramatis menu's About. app.ts draws it as a scene modal (tosijs-3d's
// fitPanel + showModal), so it reads the same flat and in a headset.

/** Set once the intro has been shown, so it shows on a first visit only. */
export const INTRO_SEEN_KEY = 'dramatis-creator-intro-seen'

export const INTRO_TITLE = 'Dramatis'

export const INTRO_TEXT = [
  'An open 3D character creator for the web. Shape a body, dress it, give it ' +
    'something to hold, then export it as a GLB or VRM that works in three.js, ' +
    'Unity, Godot and other engines, its licences inside.',
  'The panel shapes the character, a tab per part. The menus on the bar export ' +
    'it, share it as a link, and lead to the demos. Your characters stay in this ' +
    'browser; there are no accounts.',
]

export function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    // A private window: it shows again next visit, which is harmless.
  }
}
