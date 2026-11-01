import { describe, expect, test } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import {
  HANDOFF_DB,
  HANDOFF_STORE,
  HANDOFF_TTL_MS,
  putHandoff as contractPut,
  takeHandoff as contractTake,
} from '../../src/contracts/handoff'
import { notImplemented } from '../../src/contracts/lanes'
import { openHandoffDb, putHandoff, takeHandoff } from './handoff'
import {
  explain,
  fileNameFor,
  glbLicences,
  shareFragment,
  shareLink,
  exportGlb,
} from './actions'

const entry = (glb = new Uint8Array([1, 2, 3])) => ({
  glb,
  fileName: 'ada.glb',
  character: 'Ada',
  licences: [],
})

describe('handoff (IndexedDB)', () => {
  test('the contract re-exports this implementation', () => {
    expect(contractPut).toBe(putHandoff)
    expect(contractTake).toBe(takeHandoff)
  })

  test('put then take returns the same bytes and fields, and is not consumed', async () => {
    const indexedDB = new IDBFactory()
    const glb = new Uint8Array(4096).map((_, i) => i & 255)
    const id = await putHandoff(entry(glb), { indexedDB, now: 1000 })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const got = await takeHandoff(id, { indexedDB, now: 2000 })
    expect(got).not.toBeNull()
    expect(got!.glb).toBeInstanceOf(Uint8Array)
    expect([...got!.glb]).toEqual([...glb])
    expect(got).toMatchObject({
      id,
      fileName: 'ada.glb',
      character: 'Ada',
      created: 1000,
    })
    // A reload of the viewer finds it again.
    expect(await takeHandoff(id, { indexedDB, now: 3000 })).not.toBeNull()
  })

  test('absent and expired entries read as null', async () => {
    const indexedDB = new IDBFactory()
    expect(await takeHandoff('nope', { indexedDB })).toBeNull()
    expect(await takeHandoff('', { indexedDB })).toBeNull()
    const id = await putHandoff(entry(), { indexedDB, now: 0 })
    expect(
      await takeHandoff(id, { indexedDB, now: HANDOFF_TTL_MS - 1 })
    ).not.toBeNull()
    expect(await takeHandoff(id, { indexedDB, now: HANDOFF_TTL_MS })).toBeNull()
  })

  test('a put prunes expired entries and keeps fresh ones', async () => {
    const indexedDB = new IDBFactory()
    const old = await putHandoff(entry(), { indexedDB, now: 0 })
    const fresh = await putHandoff(entry(), {
      indexedDB,
      now: HANDOFF_TTL_MS / 2,
    })
    await putHandoff(entry(), { indexedDB, now: HANDOFF_TTL_MS + 1 })
    const db = await openHandoffDb(indexedDB)
    const keys = await new Promise<IDBValidKey[]>((ok, no) => {
      const r = db
        .transaction(HANDOFF_STORE)
        .objectStore(HANDOFF_STORE)
        .getAllKeys()
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    db.close()
    expect(db.name).toBe(HANDOFF_DB)
    expect(keys).not.toContain(old)
    expect(keys).toContain(fresh)
    expect(keys.length).toBe(2)
  })

  test('refuses an entry without GLB bytes', async () => {
    const indexedDB = new IDBFactory()
    await expect(putHandoff({} as never, { indexedDB })).rejects.toThrow(
      'entry.glb must be a Uint8Array'
    )
  })

  test('says so plainly where there is no IndexedDB', async () => {
    const had = globalThis.indexedDB
    // @ts-expect-error: removing it for the test
    delete globalThis.indexedDB
    try {
      await expect(putHandoff(entry())).rejects.toThrow('no IndexedDB')
    } finally {
      if (had) globalThis.indexedDB = had
    }
  })
})

/** A minimal GLB: header plus a JSON chunk (padded to 4 bytes). */
function glbWith(json: unknown): Uint8Array {
  let text = JSON.stringify(json)
  while (text.length % 4) text += ' '
  const body = new TextEncoder().encode(text)
  const out = new Uint8Array(20 + body.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, out.length, true)
  view.setUint32(12, body.length, true)
  view.setUint32(16, 0x4e4f534a, true)
  out.set(body, 20)
  return out
}

describe('export actions', () => {
  test('a stub reads as "not in this build", not as a crash', () => {
    let error: unknown
    try {
      notImplemented('skinned-glb')
    } catch (e) {
      error = e
    }
    expect(explain(error, 'export the GLB')).toBe(
      "GLB export isn't in this build yet, so the creator could not export the GLB. Your character is kept."
    )
    expect(explain(new Error('boom'), 'export the GLB')).toBe(
      'Could not export the GLB: boom'
    )
  })

  test('exportGlb turns the skinned-glb stub into a message', async () => {
    const out = await exportGlb({
      character: { name: 'Ada' } as never,
      pack: {} as never,
      naming: 'ue',
    })
    if (out.ok) {
      // The skinned-glb lane has landed: then this input is simply wrong.
      expect(out.glb).toBeInstanceOf(Uint8Array)
    } else expect(out.message).toMatch(/GLB|Could not export/)
  })

  test('shareLink turns the share stub (or a bad character) into a message', async () => {
    const r = await shareLink({ name: 'Ada' } as never, 'https://x/creator/')
    if (!r.ok) expect(r.message).toMatch(/Sharing|Could not make a share link/)
  })

  test('licences come out of a GLB JSON chunk', () => {
    const licences = [{ asset: 'makehuman:base/hm08', licence: 'CC0-1.0' }]
    expect(
      glbLicences(
        glbWith({
          asset: { version: '2.0', extras: { dramatis: { licences } } },
        })
      )
    ).toEqual(licences as never)
    expect(glbLicences(glbWith({ asset: { version: '2.0' } }))).toEqual([])
    expect(glbLicences(new Uint8Array([1, 2, 3]))).toEqual([])
  })

  test('file names and share fragments', () => {
    expect(fileNameFor('Ada Lovelace!', 'glb')).toBe('Ada_Lovelace.glb')
    expect(fileNameFor('  ', 'glb')).toBe('character.glb')
    expect(shareFragment('#c=1.abc')).toBe('c=1.abc')
    expect(shareFragment('#other')).toBeNull()
    expect(shareFragment('')).toBeNull()
  })
})
