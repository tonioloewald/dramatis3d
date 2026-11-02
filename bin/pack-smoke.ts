#!/usr/bin/env bun
// The packed-tarball smoke test: what an adopter installs, not what the repo tests.
//
//   bun run build && bun bin/pack-smoke.ts        pack the working tree, then check it
//   SMOKE_TARBALL=path/to/dramatis-x.y.z.tgz bun bin/pack-smoke.ts
//                                                 check a tarball someone else packed
//
// It honours SMOKE_TARBALL and prints the tarball's path, which is the contract
// tosijs-coding-practices/tools/publish-smoke.ts holds a `test-consumer` script to.
//
// 1. The file list: every `exports` target is packed, plus README, LICENSE and
//    CHANGELOG; nothing from reviews/, reports/, samples/, site/, src/, test/ or
//    tools/, and no test file. (The tarball once had no dist/ and ~21 MB of
//    samples and reports: reviews/0.1.0-pre-minor.md.)
// 2. `npm install` of the tarball and three into a scratch project outside the
//    repo, with peers NOT auto-installed, so Babylon is absent. (tosijs-3d
//    declares @babylonjs/* as required peers, so a plain `npm i dramatis` pulls
//    them in; --legacy-peer-deps is how a three.js user keeps them out.)
// 3. `import 'dramatis'` and `import 'dramatis/three'` at runtime, under node and
//    under bun, each checking a few named exports and doing one real call.
// 4. A consumer typecheck of both entries with skipLibCheck off.
//
// Network: the install fetches three, fflate and tosijs-3d from the registry.

import { $ } from 'bun'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const failures: string[] = []
const fail = (why: string) => {
  failures.push(why)
  console.error(`FAIL ${why}`)
}
const pass = (what: string) => console.log(`ok   ${what}`)

const work = mkdtempSync(join(tmpdir(), 'dramatis-pack-smoke-'))
try {
  // --- 1. pack (or take the given tarball) and read its file list ------------
  let tarball = process.env.SMOKE_TARBALL
    ? resolve(process.env.SMOKE_TARBALL)
    : ''
  if (!tarball) {
    for (const entry of ['dist/index.js', 'dist/three/index.js'])
      if (!existsSync(join(ROOT, entry))) {
        console.error(`${entry} is missing: run \`bun run build\` first.`)
        process.exit(2)
      }
    const packed = await $`npm pack --json --pack-destination ${work}`
      .cwd(ROOT)
      .quiet()
    tarball = join(work, JSON.parse(packed.stdout.toString())[0].filename)
  }
  if (!existsSync(tarball)) {
    console.error(`no tarball at ${tarball}`)
    process.exit(2)
  }
  console.log(`tarball: ${tarball}`)

  const listing = (await $`tar -tzf ${tarball}`.quiet()).stdout
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(/^package\//, ''))
  const files = new Set(listing)

  const targets = new Set<string>()
  const collect = (v: unknown): void => {
    if (typeof v === 'string') targets.add(v.replace(/^\.\//, ''))
    else if (v && typeof v === 'object') Object.values(v).forEach(collect)
  }
  collect(pkg.exports)
  for (const name of [...targets, 'README.md', 'LICENSE', 'CHANGELOG.md'])
    files.has(name) ? pass(`packs ${name}`) : fail(`the tarball has no ${name}`)

  const forbidden = listing.filter(
    (f) =>
      /^(reviews|reports|samples|site|src|test|tools|www|\.github)\//.test(f) ||
      /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) ||
      /(^|\/)\.[^/]+$/.test(f)
  )
  forbidden.length
    ? fail(`the tarball ships what it should not:\n  ${forbidden.join('\n  ')}`)
    : pass(
        `no reviews, reports, samples, site, sources, tests or dotfiles (${listing.length} files)`
      )

  // --- 2. install it the way a three.js user would ---------------------------
  const app = join(work, 'app')
  await $`mkdir -p ${app}`
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify({ name: 'smoke', private: true, type: 'module' })
  )
  const three = pkg.devDependencies.three
  const typesThree = pkg.devDependencies['@types/three']
  const typescript = pkg.devDependencies.typescript
  const install =
    await $`npm install --no-audit --no-fund --legacy-peer-deps ${tarball} three@${three} @types/three@${typesThree} typescript@${typescript}`
      .cwd(app)
      .nothrow()
      .quiet()
  if (install.exitCode !== 0) {
    fail(`npm install failed:\n${install.stderr.toString()}`)
    throw new Error('install failed')
  }
  pass(`npm install of the tarball with three@${three}`)
  existsSync(join(app, 'node_modules', '@babylonjs'))
    ? fail('Babylon was installed; the three.js smoke would prove nothing')
    : pass('Babylon is not installed')

  // --- 3. import both entries under node and under bun -----------------------
  const probe = `
    import * as dramatis from 'dramatis'
    import * as three from 'dramatis/three'
    const want = {
      dramatis: ['buildCharacter', 'exportCharacterGlb', 'exportCharacterVrm',
        'writeCharacterGlb', 'readCharacter', 'writeCharacter',
        'encodeShareLink', 'decodeShareLink', 'licenceManifest'],
      'dramatis/three': ['characterObject', 'updateCharacterObject',
        'characterClip', 'bodyGeometry', 'morphedBodyGeometry'],
    }
    const mods = { dramatis, 'dramatis/three': three }
    const missing = []
    for (const [mod, names] of Object.entries(want))
      for (const n of names)
        if (typeof mods[mod][n] !== 'function') missing.push(mod + '.' + n)
    if (missing.length) throw new Error('missing exports: ' + missing.join(', '))
    const geometry = three.bodyGeometry([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2])
    if (geometry.getAttribute('normal')?.count !== 3)
      throw new Error('bodyGeometry did not build a three.js geometry')
    console.log('imported dramatis (' + Object.keys(dramatis).length +
      ' exports) and dramatis/three (' + Object.keys(three).length + ')')
  `
  writeFileSync(join(app, 'probe.mjs'), probe)
  for (const [runtime, cmd] of [
    ['node', ['node', 'probe.mjs']],
    ['bun', [process.execPath, 'probe.mjs']],
  ] as const) {
    const r = await $`${cmd}`.cwd(app).nothrow().quiet()
    r.exitCode === 0
      ? pass(`${runtime}: ${r.stdout.toString().trim()}`)
      : fail(`${runtime} could not import the package:\n${r.stderr.toString()}`)
  }

  // --- 4. a consumer typecheck, skipLibCheck off -----------------------------
  writeFileSync(
    join(app, 'consumer.ts'),
    `import { buildCharacter, decodeShareLink, type BuiltCharacter } from 'dramatis'
import { characterObject, bodyGeometry } from 'dramatis/three'
export const used = [buildCharacter, decodeShareLink, characterObject, bodyGeometry]
export type Built = BuiltCharacter
`
  )
  writeFileSync(
    join(app, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2022', 'DOM'],
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      files: ['consumer.ts'],
    })
  )
  const tsc = await $`node node_modules/typescript/bin/tsc -p tsconfig.json`
    .cwd(app)
    .nothrow()
    .quiet()
  tsc.exitCode === 0
    ? pass('a consumer typechecks both entries (skipLibCheck off)')
    : fail(
        `the published types do not compile for a consumer:\n${tsc.stdout.toString()}`
      )
} catch (e) {
  if (!failures.length) fail(String(e))
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (failures.length) {
  console.error(`\npack smoke: ${failures.length} failure(s)`)
  process.exit(1)
}
console.log(
  '\npack smoke: the tarball installs and imports as an adopter gets it'
)
