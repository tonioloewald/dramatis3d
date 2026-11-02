import { describe, expect, test } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import {
  HANDOFF_DB,
  HANDOFF_ID_MAX,
  HANDOFF_STORE,
  HANDOFF_TTL_MS,
  putHandoff as contractPut,
  takeHandoff as contractTake,
} from '../../src/contracts/handoff'
import { notImplemented } from '../../src/contracts/lanes'
import { writeGlb } from 'tosijs-3d/glb-chunks'
import { readCharacter, writeCharacter } from 'tosijs-3d/character-file'
import { openHandoffDb, putHandoff, takeHandoff } from './handoff'
import {
  CHARACTER_FILE_MAX,
  importText,
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

/** A minimal GLB: header plus a JSON chunk, no binary chunk. */
const glbWith = (json: unknown): Uint8Array => writeGlb(json, null)

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
    // A short read (a download cut off inside the JSON chunk) is not a GLB.
    const whole = glbWith({
      asset: { version: '2.0', extras: { dramatis: { licences } } },
    })
    expect(glbLicences(whole.subarray(0, whole.byteLength - 8))).toEqual([])
  })

  test('file names and share fragments', () => {
    expect(fileNameFor('Ada Lovelace!', 'glb')).toBe('Ada_Lovelace.glb')
    expect(fileNameFor('  ', 'glb')).toBe('character.glb')
    expect(shareFragment('#c=1.abc')).toBe('c=1.abc')
    expect(shareFragment('#other')).toBeNull()
    expect(shareFragment('')).toBeNull()
  })
})

// The ?handoff= door's hostile-input tests (src/contracts/doors.ts). The id
// comes from the URL; the store is this origin's own, written only by the
// creator.
describe('hostile ?handoff=', () => {
  /** An IndexedDB that fails the test if it is ever opened. */
  const untouched = {
    open() {
      throw new Error('IndexedDB was opened for a refused id')
    },
  } as unknown as IDBFactory

  test('hostile ?handoff=: oversize ids are refused before IndexedDB', async () => {
    expect(
      await takeHandoff('a'.repeat(HANDOFF_ID_MAX + 1), {
        indexedDB: untouched,
      })
    ).toBeNull()
    expect(
      await takeHandoff('a'.repeat(1_000_000), { indexedDB: untouched })
    ).toBeNull()
  })

  test('hostile ?handoff=: malformed ids read as null', async () => {
    const indexedDB = new IDBFactory()
    await putHandoff(entry(), { indexedDB })
    for (const id of ['../../etc', '%00', ' ', '\u0000', '*', '{}'])
      expect(await takeHandoff(id, { indexedDB })).toBeNull()
    for (const id of [null, 42, {}, ['x']])
      expect(
        await takeHandoff(id as unknown as string, { indexedDB: untouched })
      ).toBeNull()
  })

  test('hostile ?handoff=: prototype keys read as null, and pollute nothing', async () => {
    const indexedDB = new IDBFactory()
    await putHandoff(entry(), { indexedDB })
    for (const id of ['__proto__', 'constructor', 'prototype', 'toString'])
      expect(await takeHandoff(id, { indexedDB })).toBeNull()
    expect(({} as Record<string, unknown>).glb).toBeUndefined()
  })
})

// The file door's hostile-input tests: import character (.json) reads the
// file through importText, then readCharacter as the creator's applyDoc does.
describe('hostile import character (.json)', () => {
  const defaults = { settings: { gender: 1, hair: 'short02' } }
  const read = async (text: string) =>
    readCharacter(await importText(new File([text], 'x.json')), defaults)

  test('hostile import character (.json): oversize files are refused unread', async () => {
    const big = new File([new Uint8Array(CHARACTER_FILE_MAX + 1)], 'big.json')
    let opened = false
    Object.defineProperty(big, 'text', {
      value: () => {
        opened = true
        return Promise.resolve('')
      },
    })
    await expect(importText(big)).rejects.toThrow(/over the 16 MB/)
    expect(opened).toBe(false)
  })

  test('hostile import character (.json): malformed files throw', async () => {
    for (const bad of [
      '',
      '{not json',
      '[1,2]',
      'null',
      '{"format":"other","version":1}',
      '{"format":"tosijs-character","version":999,"settings":{}}',
    ])
      await expect(read(bad)).rejects.toThrow()
  })

  test('hostile import character (.json): prototype keys are data, and pollute nothing', async () => {
    const json = JSON.stringify(
      writeCharacter({
        name: 'x',
        settings: { gender: 0 },
        cloth: {},
        tailor: [],
        garments: {},
      })
    )
      .replace(
        '"settings":{',
        '"settings":{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},'
      )
      .replace('{', '{"__proto__":{"polluted":"yes"},')
    const { character } = await read(json)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(character.settings)).toBe(Object.prototype)
    expect(
      (character.settings as Record<string, unknown>).polluted
    ).toBeUndefined()
    expect(character.settings.gender).toBe(0)
  })
})
