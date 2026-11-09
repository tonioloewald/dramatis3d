import { describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  clipProblems,
  embeddedClipProblems,
  licenceProblems,
  morphProblems,
  skeletonProblems,
  threeProblems,
  validatorErrors,
} from './checks'
import { clipBytes } from './fixture'
import { readGlb } from 'tosijs-3d/glb-chunks'

/*
GATE 1, THE AUTOMATED HALF: every GLB in samples/out/ (written by the
skinned-glb lane's bin/export-sample.ts) against the export profile
(site/docs/export-format.md). Seven checks per file:

1. the Khronos glTF validator reports zero errors;
2. the skeleton is the profile's 65 joints, named per the file's naming;
3. morph targets are named per the profile (face units, in order, declared);
4. asset.extras.dramatis carries licence entries, to the schema;
5. three's GLTFLoader loads it under bun, with a SkinnedMesh in it;
6. UAL's Walk_Loop (Quaternius, CC0) binds by name to the major joints and
   moves them;
7. any clips the file carries (#3908) name a licence the file lists, and
   each binds to the major joints and moves them in three.

With no GLB in samples/out/, each check is registered as skipped under a
name that starts NOT RUN, so the summary shows it. It never passes. The
engine imports (Babylon, Unity, Godot, Unreal) are spike 1, not this file.

fixtures.test.ts proves each check can fail.
*/

const ROOT = join(import.meta.dir, '..', '..')
const OUT = join(ROOT, 'samples', 'out')

function exports(): string[] {
  try {
    return readdirSync(OUT)
      .filter((f) => f.toLowerCase().endsWith('.glb'))
      .sort()
      .map((f) => join(OUT, f))
  } catch {
    return []
  }
}

const CHECKS = [
  'validator: zero errors',
  'skeleton: the profile joint names',
  'morph targets: named per the profile',
  'licences: entries in asset.extras',
  'three.js: GLTFLoader loads it under bun',
  'UAL clip: binds by name to the major joints and moves them',
  'own clips: licensed, bind and move',
] as const

const files = exports()

if (files.length === 0) {
  console.warn(
    `\ngate 1: NOT RUN. samples/out/ has no GLB, so none of the ${CHECKS.length} checks ran.\n` +
      '        (bin/export-sample.ts writes them; see LANES.md, lane skinned-glb.)\n'
  )
  describe('gate 1', () => {
    for (const check of CHECKS)
      test.skip(`NOT RUN (samples/out/ has no GLB): ${check}`, () => {})
  })
}

for (const path of files) {
  const name = relative(ROOT, path)
  describe(`gate 1: ${name}`, () => {
    const load = async (): Promise<Uint8Array> =>
      new Uint8Array(await Bun.file(path).arrayBuffer())
    test(CHECKS[0], async () => {
      expect(await validatorErrors(await load())).toEqual([])
    })
    test(CHECKS[1], async () => {
      expect(skeletonProblems(readGlb(await load()))).toEqual([])
    })
    test(CHECKS[2], async () => {
      expect(morphProblems(readGlb(await load()))).toEqual([])
    })
    test(CHECKS[3], async () => {
      expect(licenceProblems(readGlb(await load()))).toEqual([])
    })
    test(CHECKS[4], async () => {
      expect(await threeProblems(await load())).toEqual([])
    })
    test(
      CHECKS[5],
      async () => {
        expect(await clipProblems(await load(), await clipBytes())).toEqual([])
      },
      60_000
    )
    test(
      CHECKS[6],
      async () => {
        expect(await embeddedClipProblems(await load())).toEqual([])
      },
      60_000
    )
  })
}
