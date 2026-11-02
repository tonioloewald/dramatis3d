// Naming a saved character: what the save and rename popups decide, kept free
// of the scene and the DOM so it can be tested under bun.

import type { TosiDialog } from 'tosijs-ui'

/** What a typed name comes to. */
export type NameDecision =
  | { ok: false; message: string }
  | { ok: true; name: string; overwrites: boolean }

/**
 * A name typed into the save or rename popup. `current` is the saved name being
 * saved again or renamed (saving it again is not an overwrite); `reserved` is
 * the store's own key for the working figure.
 */
export function decideName(
  typed: string | null,
  saved: readonly string[],
  current: string,
  reserved: string
): NameDecision | null {
  if (typed === null) return null // cancelled
  const name = typed.trim()
  if (!name) return { ok: false, message: 'a saved character needs a name' }
  if (name === reserved)
    return {
      ok: false,
      message: `"${reserved}" is kept for the working figure`,
    }
  return {
    ok: true,
    name,
    overwrites: name !== current && saved.includes(name),
  }
}

/**
 * tosijs-ui's dialog, as the page registered it. The site's shared bundle
 * defines the tosi-* elements; the creator's own bundle borrows the class
 * rather than bundling (and registering) a second copy.
 */
export function dialogs(): typeof TosiDialog | null {
  const found = customElements.get('tosi-dialog') as
    | (typeof TosiDialog & CustomElementConstructor)
    | undefined
  return found ?? null
}
