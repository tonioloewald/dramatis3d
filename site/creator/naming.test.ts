import { describe, expect, test } from 'bun:test'
import { decideName } from './naming'

const W = '(working)'

describe('decideName (the save and rename popups)', () => {
  test('cancelling decides nothing', () => {
    expect(decideName(null, [], '', W)).toBeNull()
  })

  test('a blank name, or the working figure’s key, is refused with a reason', () => {
    expect(decideName('   ', [], '', W)).toMatchObject({ ok: false })
    expect(decideName(W, [], '', W)).toMatchObject({ ok: false })
  })

  test('a new name is trimmed and replaces nothing', () => {
    expect(decideName('  Ada ', ['Bo'], '', W)).toEqual({
      ok: true,
      name: 'Ada',
      overwrites: false,
    })
  })

  test('saving under its own name again is not an overwrite; taking another’s is', () => {
    expect(decideName('Ada', ['Ada', 'Bo'], 'Ada', W)).toMatchObject({
      overwrites: false,
    })
    expect(decideName('Bo', ['Ada', 'Bo'], 'Ada', W)).toMatchObject({
      overwrites: true,
    })
  })
})
