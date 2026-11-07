// Which body a character file has: MakeHuman's, or a mesh (src/mesh/).

import type { Character } from 'tosijs-3d/character-file'

/** MakeHuman's body, as `settings.source` names it. */
export const MAKEHUMAN_SOURCE = 'MakeHuman'

/** Whether a character's body is a mesh rather than MakeHuman's. */
export function hasMeshBody(character: Pick<Character, 'settings'>): boolean {
  const source = character.settings.source
  return typeof source === 'string' && source !== MAKEHUMAN_SOURCE
}
