// The share link. Lane: share-licence (src/share/). Page: site/docs/licences.md
// covers the licences; the link's format is specified here.

import type {
  Character,
  ReadCharacter,
  SlotLook,
} from 'tosijs-3d/character-file'
import { notImplemented } from './lanes'

/**
 * THE LINK: `<base>#c=<version>.<payload>`, where `payload` is the
 * character document (`writeCharacter`, JSON, UTF-8) compressed with raw
 * DEFLATE (fflate's `deflateSync`, level 9) and written base64url without
 * padding. The fragment never reaches a server.
 *
 * A link carries the sliders, looks and choices only: garments of the
 * wearer's own (`Character.garments`), tailor outlines and file bodies
 * (`bodies` with `file`) are dropped, and each drop is reported, because
 * their bytes do not fit in a URL.
 */
export const SHARE_FRAGMENT_KEY = 'c'

/** The payload layout this module writes; a newer one is refused on read. */
export const SHARE_LINK_VERSION = 1

/**
 * The longest link `encodeShareLink` makes, in characters, fragment
 * included: chat apps and QR codes stay reliable below it. A character that
 * would exceed it is an error, not a truncated link.
 */
export const SHARE_LINK_BUDGET = 8000

export interface ShareLink {
  /** The whole link: `base` with the fragment. */
  url: string
  /** The fragment alone, without `#`: `c=1.<payload>`. */
  fragment: string
  /** What was left out of the link, one line each (empty when nothing was). */
  dropped: string[]
}

export interface EncodeShareOptions {
  /** The creator page's URL. Default: the site's creator, `https://dramatis.tosijs.net/creator/`. */
  base?: string
}

/** Encode a character as a share link. Throws when it exceeds `SHARE_LINK_BUDGET`. */
export function encodeShareLink(
  character: Character,
  options: EncodeShareOptions = {}
): ShareLink {
  void character
  void options
  return notImplemented('share-licence')
}

/**
 * Read a share link back: `input` is a whole URL, a fragment (with or
 * without `#`), or the payload. `defaults` are `readCharacter`'s. Throws on
 * a link that is not a Dramatis share link or is newer than this module;
 * what was filled in is in `warnings`.
 */
export function decodeShareLink(
  input: string,
  defaults: {
    settings: Record<string, unknown>
    slots?: Record<string, SlotLook>
  }
): ReadCharacter {
  void input
  void defaults
  return notImplemented('share-licence')
}
