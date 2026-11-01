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

import { notImplemented } from './lanes'
import type { LicenceEntry } from './licences'

/** The database: one object store, keyed by id. */
export const HANDOFF_DB = 'dramatis-handoff'
export const HANDOFF_STORE = 'exports'
/** IndexedDB schema version. */
export const HANDOFF_DB_VERSION = 1

/** The viewer page, relative to the site root. */
export const VIEWER_PATH = '/viewer/'
/** The viewer's query parameters: a handoff id, or a GLB's URL. */
export const HANDOFF_PARAM = 'handoff'
export const GLB_URL_PARAM = 'glb'

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

/** Put an export in the store (pruning expired entries); resolves to its id. */
export async function putHandoff(
  entry: Omit<HandoffEntry, 'id' | 'created'>
): Promise<string> {
  void entry
  return notImplemented('site-creator')
}

/**
 * Read an export by id; null when it is absent or expired. It is not
 * deleted on read, so a reload of the viewer still finds it.
 */
export async function takeHandoff(id: string): Promise<HandoffEntry | null> {
  void id
  return notImplemented('site-creator')
}

/** The viewer's URL for a handoff id, against `origin` (default: the page's). */
export function viewerUrl(id: string, origin?: string): string {
  const base = origin ?? globalThis.location?.origin ?? ''
  return `${base}${VIEWER_PATH}?${HANDOFF_PARAM}=${encodeURIComponent(id)}`
}
