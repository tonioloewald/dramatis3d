// The share link (lane share-licence). The contract, with the format, is
// src/contracts/share.ts; the page is site/docs/licences.md ("Share links").

import { deflateSync, Inflate } from 'fflate'
import {
  readCharacter,
  writeCharacter,
  type Character,
  type CharacterBody,
  type ReadCharacter,
  type SlotLook,
} from 'tosijs-3d/character-file'
import type { EncodeShareOptions, ShareLink } from '../contracts/share'

// The constants are the contract's; they are restated here, not imported,
// because the contract module re-exports this one (no import cycle).
const KEY = 'c'
const VERSION = 1
const BUDGET = 8000
const DEFAULT_BASE = 'https://dramatis.tosijs.net/creator/'

/**
 * The most a payload may inflate to. A character document without garments
 * or file bodies is a few kilobytes; a link that inflates past this is not one
 * of ours (or is a deflate bomb), and is refused before it is parsed.
 */
export const SHARE_INFLATED_LIMIT = 256 * 1024

const fail = (why: string): never => {
  throw new Error(`share-link: ${why}`)
}

/** What a share link leaves out, and the character without it. */
function shareable(character: Character): {
  character: Character
  dropped: string[]
} {
  const dropped: string[] = []
  for (const name of Object.keys(character.garments))
    dropped.push(`garment ${name}: its file does not fit in a link`)
  if (character.tailor.length > 0)
    dropped.push(
      `tailor: ${character.tailor.length} outline(s) in progress are not shared`
    )
  const bodies: Record<string, CharacterBody> = {}
  for (const [name, body] of Object.entries(character.bodies ?? {})) {
    if (body.file) {
      dropped.push(
        `body ${name}: opened from a file (${body.file.name}), which does not fit in a link`
      )
      continue
    }
    bodies[name] = { ...body }
  }
  return {
    character: {
      name: character.name,
      settings: character.settings,
      cloth: character.cloth,
      tailor: [],
      garments: {},
      ...(Object.keys(bodies).length ? { bodies } : {}),
    },
    dropped,
  }
}

/**
 * A character as a share link: its character file, deflated, base64url, in
 * the URL fragment (`<base>#c=1.<payload>`; see `SHARE_FRAGMENT_KEY`).
 * Garments of the wearer's own, tailor outlines and file bodies are left out
 * and listed in `dropped`. `options.base` is the creator page (default
 * `https://dramatis.tosijs.net/creator/`). Throws when the link would exceed
 * `SHARE_LINK_BUDGET`.
 */
export function encodeShareLink(
  character: Character,
  options: EncodeShareOptions = {}
): ShareLink {
  const { character: kept, dropped } = shareable(character)
  // No `saved` stamp: the same character makes the same link.
  const json = JSON.stringify(writeCharacter(kept))
  const payload = toBase64Url(
    deflateSync(new TextEncoder().encode(json), { level: 9 })
  )
  const fragment = `${KEY}=${VERSION}.${payload}`
  const base = (options.base ?? DEFAULT_BASE).replace(/#.*$/, '')
  const url = `${base}#${fragment}`
  if (url.length > BUDGET)
    fail(
      `the link would be ${url.length} characters, over the ${BUDGET} budget; ` +
        `save the character as a file instead`
    )
  return { url, fragment, dropped }
}

/**
 * A share link read back as a character. `input` is a whole URL, a fragment
 * (with or without `#`) or the payload alone; `defaults` are
 * `readCharacter`'s (the page's settings and slots). Throws on input that is
 * not a Dramatis share link, a link newer than this module, a payload
 * longer than `SHARE_LINK_BUDGET` characters, or one that inflates past
 * 256 KB; what was skipped or filled in is in `warnings`.
 */
export function decodeShareLink(
  input: string,
  defaults: {
    settings: Record<string, unknown>
    slots?: Record<string, SlotLook>
  }
): ReadCharacter {
  if (typeof input !== 'string') fail('not a string')
  const { version, payload } = parseLink(input.trim())
  // Every link this module has made is version 1 or later: a lower number is
  // not one of ours, and is refused rather than read as the current version.
  if (version < 1)
    fail(`link version ${version} was never written: not a Dramatis share link`)
  if (version > VERSION)
    fail(
      `link version ${version} is newer than this page reads (${VERSION}); open it on the current site`
    )
  // No link this module makes is longer than the budget, so a longer payload
  // is refused before it is decoded or inflated (a deflate bomb is cheap to
  // send and costly to open).
  if (payload.length > BUDGET)
    fail(
      `the payload is ${payload.length} characters, over the ${BUDGET} budget: not a Dramatis share link`
    )
  const bytes = fromBase64Url(payload)
  const json = inflateCapped(bytes)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(json)
  } catch {
    return fail('the payload is not UTF-8 text')
  }
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return fail('the payload is not JSON')
  }
  if (doc == null || typeof doc !== 'object' || Array.isArray(doc))
    fail('the payload is not a character document')
  // A link carries no garments and no file bodies (encodeShareLink drops
  // them). One that does was not made here: what it carries is not decoded.
  const raw = { ...(doc as Record<string, unknown>) }
  const warnings: string[] = []
  const garments = raw.garments
  if (
    garments != null &&
    typeof garments === 'object' &&
    Object.keys(garments).length > 0
  )
    warnings.push(
      `garments: a share link carries none; ${
        Object.keys(garments).length
      } skipped`
    )
  raw.garments = {}
  raw.tailor = []
  if (raw.bodies != null && typeof raw.bodies === 'object') {
    const bodies: Record<string, unknown> = {}
    for (const [name, b] of Object.entries(raw.bodies)) {
      if (b != null && typeof b === 'object' && 'data' in b)
        warnings.push(`body ${name}: a share link carries no files; skipped`)
      else bodies[name] = b
    }
    raw.bodies = bodies
  }
  let read: ReadCharacter
  try {
    read = readCharacter(raw, defaults)
  } catch (e) {
    return fail((e as Error).message)
  }
  return {
    character: read.character,
    warnings: [...warnings, ...read.warnings],
  }
}

/** A whole URL, a fragment (with or without `#`), or the bare payload. */
function parseLink(input: string): { version: number; payload: string } {
  let rest = input
  const hash = rest.indexOf('#')
  if (hash >= 0) rest = rest.slice(hash + 1)
  // A fragment may hold other parameters beside ours.
  const params = rest.split('&')
  const ours = params.find((p) => p.startsWith(`${KEY}=`))
  if (ours != null) rest = ours.slice(KEY.length + 1)
  else if (hash >= 0 || rest.includes('='))
    fail(`no "${KEY}=" in the link: not a Dramatis share link`)
  const m = /^(\d{1,4})\.([A-Za-z0-9_-]+)$/.exec(rest)
  if (m == null) return fail('not a Dramatis share link')
  return { version: Number(m[1]), payload: m[2]! }
}

/**
 * How much compressed input is handed to the inflater at a time. DEFLATE
 * expands at most about 1032:1, so one slice inflates to about 1 MB at most
 * before the cap below can refuse it.
 */
const INFLATE_SLICE = 1024

/** Inflate `bytes`, refusing output past `SHARE_INFLATED_LIMIT`. Internal; exported for the tests. */
export function inflateCapped(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = []
  let size = 0
  let done = false
  const inflater = new Inflate((chunk, final) => {
    size += chunk.length
    if (size > SHARE_INFLATED_LIMIT)
      fail(`the payload inflates past ${SHARE_INFLATED_LIMIT} bytes`)
    chunks.push(chunk)
    if (final) done = true
  })
  try {
    // In slices, so the cap stops the work early rather than after it.
    for (let at = 0; at < bytes.length; at += INFLATE_SLICE)
      inflater.push(
        bytes.subarray(at, at + INFLATE_SLICE),
        at + INFLATE_SLICE >= bytes.length
      )
    if (bytes.length === 0) inflater.push(bytes, true)
  } catch (e) {
    const message = (e as Error).message
    if (message.startsWith('share-link:')) throw e
    return fail(`the payload is not deflated data (${message})`)
  }
  if (!done) fail('the payload is truncated')
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** base64url, no padding (RFC 4648 §5). */
export function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1)
    fail('the payload is not base64url')
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const s = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
