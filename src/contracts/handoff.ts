// THE CREATOR-TO-VIEWER HANDOFF, site-internal (not exported from any public
// entry). Lane: site-creator implements both sides; three-viewer consumes it.
//
// Mechanism: IndexedDB on the site's origin. The creator page puts the exported
// GLB in the database under a fresh id and opens the viewer page at
// `/viewer/?handoff=<id>` (a new tab); the viewer reads it by that id.
//
// Why IndexedDB: an exported character is several megabytes, more than
// sessionStorage holds (about 5 MB, strings, per tab, so a new tab starts
// empty) and more than belongs in a URL. postMessage to an opened window needs
// the creator tab alive and a handshake, and breaks on a reload of the viewer.
// IndexedDB is same-origin, shared between tabs, stores bytes as they are, and
// survives a reload. The viewer also takes `?glb=<url>` for a GLB by URL.

import type { LicenceEntry } from './licences'

/** The database: one object store, keyed by id. */
export const HANDOFF_DB = 'dramatis-handoff'
export const HANDOFF_STORE = 'exports'
/** IndexedDB schema version. */
export const HANDOFF_DB_VERSION = 1

/** The viewer page, relative to the site root. */
export const VIEWER_PATH = '/viewer/'
/** The Unity player's page, which takes the same `?handoff=<id>`. */
export const UNITY_PATH = '/unity/'
/** The viewer's query parameters: a handoff id, or a GLB's URL. */
export const HANDOFF_PARAM = 'handoff'
export const GLB_URL_PARAM = 'glb'

/** The longest handoff id taken (ids are UUIDs, 36 characters). */
export const HANDOFF_ID_MAX = 64
/** The most a `?glb=<url>` fetch reads before it gives up (`fetchGlb`). */
export const GLB_MAX_BYTES = 128 * 2 ** 20

/** Entries older than this are deleted whenever one is put. */
export const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000

/** What the creator hands the viewer: the record in the store. */
export interface HandoffEntry {
  /** A random id (crypto.randomUUID()). */
  id: string
  /** The exported GLB, exactly as the export button would download it. */
  glb: Uint8Array
  /** The download's file name, `<character>.glb`. */
  fileName: string
  /** The character's name, for the viewer's title. */
  character: string
  /** Copied from the GLB's extras, so the viewer can show them before parsing. */
  licences: LicenceEntry[]
  /** Date.now() when it was put. */
  created: number
}

/**
 * Put an export in the store (pruning expired entries); resolves to its id.
 *
 * Read an export by id (`takeHandoff`); null when it is absent or expired.
 * It is not deleted on read, so a reload of the viewer still finds it.
 *
 * Fetch a `?glb=` URL's bytes, capped at `GLB_MAX_BYTES` (`fetchGlb`).
 *
 * Implemented by site-creator in site/creator/handoff.ts.
 */
export { fetchGlb, putHandoff, takeHandoff } from '../../site/creator/handoff'

/**
 * The viewer's URL for a handoff id, against `origin` (default: the page's);
 * `path` names another page that takes a handoff (`UNITY_PATH`).
 */
export function viewerUrl(
  id: string,
  origin?: string,
  path: string = VIEWER_PATH
): string {
  const base = origin ?? globalThis.location?.origin ?? ''
  return `${base}${path}?${HANDOFF_PARAM}=${encodeURIComponent(id)}`
}
