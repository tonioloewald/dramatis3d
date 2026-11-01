import { describe, expect, test } from 'bun:test'
import { HM08_UAL } from 'tosijs-3d/human-rig'
import {
  buildCharacter,
  characterLicences,
  checkExportExtras,
  decodeShareLink,
  encodeShareLink,
  exportCharacterGlb,
  exportCharacterVrm,
  FACE_UNITS,
  jointNames,
  licenceManifest,
  lookupLicence,
  MAJOR_JOINTS,
  MIXAMO_NAMES,
  UE_JOINT_NAMES,
  UE_JOINTS,
  writeCharacterGlb,
} from '../index'
import { characterObject } from '../three/index'
import { putHandoff, takeHandoff, viewerUrl } from './handoff'

/*
THE CONTRACTS' DATA IS PINNED TO ITS SOURCES. The profile's joint table is
tosijs-3d's HM08_UAL (which is UAL's skeleton), and its face units are the
hm08 pack's 59 `expression/*` targets, a superset of tosijs-3d's UNITS. A
tosijs-3d release that changes either fails here, before an export drifts.
*/

describe('profile', () => {
  test('UE_JOINTS is tosijs-3d HM08_UAL: names, order and parents', () => {
    expect(UE_JOINTS.map((j) => [j.name, j.parent])).toEqual(
      HM08_UAL.map((r) => [r.name, r.parent])
    )
    expect(UE_JOINTS.length).toBe(65)
  })

  test('parents come before children', () => {
    const seen = new Set<string>()
    for (const j of UE_JOINTS) {
      if (j.parent !== null) expect(seen.has(j.parent)).toBe(true)
      seen.add(j.name)
    }
  })

  test('every major joint is a profile joint', () => {
    for (const j of MAJOR_JOINTS) expect(UE_JOINT_NAMES).toContain(j)
  })

  test('the Mixamo names cover every joint, once each', () => {
    expect(Object.keys(MIXAMO_NAMES).sort()).toEqual([...UE_JOINT_NAMES].sort())
    const mixamo = jointNames('mixamo')
    expect(new Set(mixamo).size).toBe(65)
    expect(mixamo[1]).toBe('mixamorig:Hips')
  })

  test('59 face units, unique, including all of tosijs-3d UNITS', async () => {
    expect(FACE_UNITS.length).toBe(59)
    expect(new Set(FACE_UNITS).size).toBe(59)
    // human-expression needs Babylon and a DOM to import, so its UNITS are
    // read from the installed declaration, which spells the tuple out.
    const dts = await Bun.file(
      Bun.resolveSync('tosijs-3d/human-expression', import.meta.dir).replace(
        /\.js$/,
        '.d.ts'
      )
    ).text()
    const tuple = dts.match(/UNITS: readonly \[([^\]]*)\]/)?.[1] ?? ''
    const units = [...tuple.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1])
    expect(units.length).toBeGreaterThan(40)
    for (const u of units) expect(FACE_UNITS as readonly string[]).toContain(u)
  })

  test('checkExportExtras accepts a good block and names what is wrong', () => {
    const good = {
      format: 'dramatis-export',
      version: 1,
      generator: 'dramatis@0.0.0',
      naming: 'ue',
      restPose: 't-pose',
      faceUnits: ['JawDrop'],
      character: 'Test',
      licences: [
        {
          asset: 'makehuman:base/hm08',
          title: 'MakeHuman hm08 base mesh',
          kind: 'base',
          licence: 'CC0-1.0',
          licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          source: 'https://github.com/makehumancommunity/makehuman',
          author: 'MakeHuman',
        },
      ],
    }
    expect(checkExportExtras(good)).toEqual([])
    expect(checkExportExtras(undefined)).toHaveLength(1)
    expect(checkExportExtras({ ...good, licences: [] })).toContain(
      'licences is missing or empty'
    )
    expect(
      checkExportExtras({ ...good, faceUnits: ['Smile'] }).join('\n')
    ).toContain('unknown unit: Smile')
    expect(
      checkExportExtras({
        ...good,
        licences: [{ ...good.licences[0], kind: 'garment', author: '' }],
      })
    ).toEqual([
      'licences[0].author is missing',
      'licences has no entry of kind base',
    ])
  })
})

describe('stubs throw "not implemented: <lane>" until their lane lands', () => {
  const pack = {} as never
  const character = {} as never
  const cases: Array<[string, () => unknown, string]> = [
    ['buildCharacter', () => buildCharacter(character, pack), 'skinned-glb'],
    ['writeCharacterGlb', () => writeCharacterGlb({} as never), 'skinned-glb'],
    [
      'exportCharacterGlb',
      () => exportCharacterGlb(character, pack),
      'skinned-glb',
    ],
    ['exportCharacterVrm', () => exportCharacterVrm(character, pack), 'vrm'],
    ['encodeShareLink', () => encodeShareLink(character), 'share-licence'],
    [
      'decodeShareLink',
      () => decodeShareLink('', { settings: {} }),
      'share-licence',
    ],
    ['licenceManifest', () => licenceManifest(), 'share-licence'],
    ['lookupLicence', () => lookupLicence('x'), 'share-licence'],
    [
      'characterLicences',
      () => characterLicences(character, pack),
      'share-licence',
    ],
    ['characterObject', () => characterObject({} as never), 'three'],
    ['putHandoff', () => putHandoff({} as never), 'site-creator'],
    ['takeHandoff', () => takeHandoff('x'), 'site-creator'],
  ]
  for (const [name, call, lane] of cases) {
    test(`${name} (${lane})`, async () => {
      // A stub names its own lane. Once the lane replaces it (and fails on
      // these empty inputs in its own way), the lane's tests cover it.
      let message = ''
      try {
        await call()
      } catch (e) {
        message = (e as Error).message
      }
      if (message.startsWith('not implemented:'))
        expect(message).toBe(`not implemented: ${lane}`)
    })
  }

  test('viewerUrl is implemented', () => {
    expect(viewerUrl('a b', 'https://dramatis.tosijs.net')).toBe(
      'https://dramatis.tosijs.net/viewer/?handoff=a%20b'
    )
  })
})
