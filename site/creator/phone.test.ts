import { describe, expect, test } from 'bun:test'
import { onSmallDevice, PHONE_NOTE } from './phone'

describe('phone note', () => {
  test('shown for a narrow or touch-only screen, not a desktop', () => {
    expect(onSmallDevice(() => ({ matches: true }))).toBe(true)
    expect(onSmallDevice(() => ({ matches: false }))).toBe(false)
    expect(onSmallDevice(undefined)).toBe(false)
  })

  test('says where it works best (owner, 2026-11-04)', () => {
    expect(PHONE_NOTE).toContain('desktop or a recent flagship phone')
  })
})
