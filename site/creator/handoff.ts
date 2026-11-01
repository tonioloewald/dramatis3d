// The creator-to-viewer handoff (src/contracts/handoff.ts), implemented.
// Site-internal: the creator puts an export here, the viewer takes it.
//
// Plain IndexedDB, no dependencies, so the viewer page can import it without
// pulling in anything of the creator's.

import {
  HANDOFF_DB,
  HANDOFF_DB_VERSION,
  HANDOFF_STORE,
  HANDOFF_TTL_MS,
  type HandoffEntry,
} from '../../src/contracts/handoff'

/** The IndexedDB the page has, or a clear error when it has none. */
function factory(given?: IDBFactory): IDBFactory {
  const f = given ?? globalThis.indexedDB
  if (!f)
    throw new Error(
      'handoff: this browser has no IndexedDB (a private window may block it)'
    )
  return f
}

/** Open (and on first use create) the handoff database. */
export function openHandoffDb(given?: IDBFactory): Promise<IDBDatabase> {
  const f = factory(given)
  return new Promise((resolve, reject) => {
    const request = f.open(HANDOFF_DB, HANDOFF_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDOFF_STORE))
        db.createObjectStore(HANDOFF_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('handoff: the database is held open by another tab'))
  })
}

/** Run one transaction; resolves when it commits. */
function inStore<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDOFF_STORE, mode)
    const request = work(tx.objectStore(HANDOFF_STORE))
    tx.oncomplete = () => resolve(request ? request.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('handoff: aborted'))
  })
}

const expired = (entry: HandoffEntry, now: number) =>
  !(entry.created + HANDOFF_TTL_MS > now)

/** Put an export in the store (pruning expired entries); resolves to its id. */
export async function putHandoff(
  entry: Omit<HandoffEntry, 'id' | 'created'>,
  options: { indexedDB?: IDBFactory; now?: number } = {}
): Promise<string> {
  if (!(entry?.glb instanceof Uint8Array))
    throw new TypeError('handoff: entry.glb must be a Uint8Array')
  const now = options.now ?? Date.now()
  const record: HandoffEntry = {
    id: crypto.randomUUID(),
    glb: entry.glb,
    fileName: entry.fileName,
    character: entry.character,
    licences: entry.licences ?? [],
    created: now,
  }
  const db = await openHandoffDb(options.indexedDB)
  try {
    await inStore(db, 'readwrite', (store) => {
      // Prune in the same transaction as the put: one commit, nothing left
      // half-done if the tab closes.
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const at = cursor.result
        if (!at) return
        if (expired(at.value as HandoffEntry, now)) at.delete()
        at.continue()
      }
      store.put(record)
    })
  } finally {
    db.close()
  }
  return record.id
}

/**
 * Read an export by id; null when it is absent or expired. It is not
 * deleted on read, so a reload of the viewer still finds it.
 */
export async function takeHandoff(
  id: string,
  options: { indexedDB?: IDBFactory; now?: number } = {}
): Promise<HandoffEntry | null> {
  if (typeof id !== 'string' || !id) return null
  const db = await openHandoffDb(options.indexedDB)
  try {
    const found = (await inStore(db, 'readonly', (store) => store.get(id))) as
      | HandoffEntry
      | undefined
    if (!found || expired(found, options.now ?? Date.now())) return null
    // IndexedDB may hand back a plain ArrayBuffer-backed view of another
    // realm's type; normalise to this realm's Uint8Array.
    const glb =
      found.glb instanceof Uint8Array
        ? found.glb
        : new Uint8Array(found.glb as ArrayBufferLike)
    return { ...found, glb }
  } finally {
    db.close()
  }
}
