# Spike 4: the three.js embed

Date: 2026-11-02. Lane three, dramatis3d task #3651. Branch `work/three`.

Question (PLAN.md, "Spikes" 4 and "Stage B"): can the engine-free core drive
a three.js `SkinnedMesh`, and what does installing `tosijs-3d` (and so
`dramatis`) cost a three.js adopter? The second answer decides stage B.

## Answers

1. **The adapter works.** `characterObject(built)` makes a `SkinnedMesh` per
   built mesh on one 65-bone `Skeleton`, face units as morph targets and
   PBR materials. `updateCharacterObject` applies a rebuilt character in
   place, and `characterClip` plays UAL clips by name. 14 unit tests cover
   it, and the sample page ran in Chrome: the character walks, and the
   sliders reshape it mid-walk with no console errors. All of this ran on a
   hand-made built character, because the builder (lane skinned-glb) does
   not exist yet (see "Not run").
2. **The browser bundle carries no Babylon.** The whole `dramatis/three`
   entry is **13.9 KiB minified, 5.3 KiB gzip** on top of three.
3. **The install carries all of Babylon.** npm 11 and bun 1.4 both install
   tosijs-3d's four `@babylonjs/*` peers by default. They come to **16.4 MB
   of the 25.4 MB download (65%)** and **117.6 MB of the 158.7 MB
   `node_modules` (74%)**: 5 times what `three` itself takes on disk. None
   of it reaches the bundle. A three.js app builds and type-checks with
   Babylon absent.
4. **Recommendation on stage B: the evidence supports it, but it doesn't
   block the first release.** Babylon is three quarters of a three.js
   adopter's install, which is the first number a size checker shows. It
   is not a runtime cost, though, and it can be skipped (below). Ship the
   first release with the skip flags documented
   (site/docs/dramatis-three.md does this). Make stage B tosijs-3d's next
   minor-or-major item, with the owner deciding when.

## Method

### Bundle size

Script: `samples/three/measure-bundle.ts` (`bun samples/three/measure-bundle.ts`).

- **Tool:** Bun 1.4.2 `Bun.build`, `target: 'browser'`, `format: 'esm'`,
  `minify: true`.
- **Entries:** for each case, a one-line entry file that imports the named
  exports from `src/three/index.ts` and passes them to `console.log`, so
  they are not tree-shaken away.
- **`three`:** external unless the row says it is bundled, because it is
  the adopter's own peer.
- **Measurements:** raw bytes of the output, and gzip level 9
  (`Bun.gzipSync`). KiB = 1024 bytes.
- **Babylon column:** a case-insensitive search of the output for
  `babylonjs`.
- **Versions:** three 0.186.1 and tosijs-3d 0.11.6, the pinned versions
  in this repo's lockfile.

| case | minified | gzip | Babylon in output |
| --- | ---: | ---: | --- |
| dramatis/three, whole entry (import \*), three external | 13.9 KiB | 5.3 KiB | no |
| characterObject + updateCharacterObject + characterClip, three external | 10.4 KiB | 3.8 KiB | no |
| morphedBodyGeometry only (tosijs-3d body maths), three external | 6.8 KiB | 2.7 KiB | no |
| baseline: three alone (the classes the adapter uses), bundled | 312.0 KiB | 70.7 KiB | no |
| dramatis/three whole entry with three bundled | 325.5 KiB | 75.9 KiB | no |

So Dramatis adds **13.5 KiB minified (5.2 KiB gzip)** to an app that already
uses three: 325.5 − 312.0, and 75.9 − 70.7.

The size is for the adapter and the body maths. The builder (lane
skinned-glb) isn't written yet, and its share of the closure (rig fit, proxy
fit and the rest) will add to this when it lands. Re-run the script then.

`src/no-babylon.test.ts` passes on this branch: both public entries, with
three checks each (the bundle, the emitted `.d.ts`, the tsc type closure),
plus the positive control. That is 8 pass, 0 fail.

### Install cost

Each case starts in an empty scratch directory containing only
`{"name":"adopter","version":"1.0.0","private":true}`, with no lockfile and
no cache tricks. Tools: npm 11.18.0 on Node 22.22.1, and bun 1.4.2, on
macOS arm64.

- **A:** `npm install --no-audit --no-fund tosijs-3d@0.11.6 three@0.186.1`
- **B:** `bun add tosijs-3d@0.11.6 three@0.186.1`
- **C:** `npm install --legacy-peer-deps …` (same packages)
- **D:** `bun install --omit=peer` (after B wrote package.json)
- **E:** `npm install <dramatis tarball> three@0.186.1`, with the tarball
  from `npm pack` of this branch
- **F:** `bun add <dramatis tarball> three@0.186.1`

**What lands.** A and B give an identical tree: tosijs-3d 0.11.6, fflate
0.8.3, the peers `@babylonjs/core`, `gui`, `loaders` and `materials` 9.33.1,
babylonjs-gltf2interface 9.33.1 and tosijs 1.10.10, plus three 0.186.1.
`jolt-physics` is an optional peer and is not installed. E and F add
`dramatis` to the same tree. So **both npm and bun auto-install the Babylon
peers**, through tosijs-3d and also through dramatis.

**Download size.** Each tarball's bytes, fetched from registry.npmjs.org
(`curl -w %{size_download}`). The unpacked size is `npm view dist.unpackedSize`.

| package | version | tarball | unpacked |
| --- | --- | ---: | ---: |
| @babylonjs/core | 9.33.1 | 13,982,827 | 73,335,492 |
| @babylonjs/loaders | 9.33.1 | 1,399,638 | 7,534,543 |
| @babylonjs/gui | 9.33.1 | 738,523 | 4,259,398 |
| @babylonjs/materials | 9.33.1 | 309,599 | 1,781,657 |
| babylonjs-gltf2interface | 9.33.1 | 12,648 | 58,572 |
| **Babylon subtotal** | | **16,443,235** | **86,969,662** |
| three | 0.186.1 | 4,648,523 | 20,443,256 |
| tosijs-3d | 0.11.6 | 3,238,098 | 11,899,255 |
| tosijs (peer, not used by the pure subpaths) | 1.10.10 | 852,161 | 2,765,245 |
| fflate | 0.8.3 | 173,034 | 796,742 |
| **total** | | **25,355,051** | **122,874,160** |

**On disk** (`du -sk node_modules`, KiB, APFS):

| case | node_modules | of which @babylonjs |
| --- | ---: | ---: |
| A npm | 158,684 | 117,620 |
| B bun | 158,680 | 117,620 |
| C npm --legacy-peer-deps | 37,964 | 0 |
| D bun --omit=peer | 37,960 | 0 |
| E npm, dramatis tarball | 159,288 | 117,620 (all four present) |
| F bun, dramatis tarball | 159,280 | 117,620 (all four present) |

Breakdown for A: @babylonjs/core 99,504, three 22,784, tosijs-3d 14,348,
@babylonjs/loaders 9,804, @babylonjs/gui 5,656, tosijs 3,036,
@babylonjs/materials 2,656, fflate 828.

**Without Babylon, does the app still work?** In C's directory, an app
imports `tosijs-3d/human-morph`, `human-pack` and `character-file` plus
three's `SkinnedMesh`.

- `bun build --target browser --minify` gives a bundle **byte-identical**
  to the same app built in A's directory (315,715 bytes, `cmp` equal, no
  "babylon" in either).
- `tsc --noEmit --strict --moduleResolution bundler` passes, with
  `@types/three` added and **no `skipLibCheck`**.

So the Babylon peers are dead weight for a three.js adopter, and the
documented skip flags are safe for the pure subpaths. One limit: `--legacy-peer-deps` and `--omit=peer` skip
peers for the adopter's **whole** project, so they are a workaround, not a
fix.

## Not run, and what is still open

- **The adapter on a real character.** `buildCharacter` and
  `writeCharacterGlb` are still stubs (lane skinned-glb). Everything here
  ran on `src/three/fixture-character.ts`: UAL's 65-joint rest, read from
  the CC0 gate-1 clip, with a blocky body of one box per bone, rigid
  skinning and three face units. The contract also promises "the same
  scene graph GLTFLoader gives for `writeCharacterGlb(built)`". The test
  for that is written (`src/three/character-object.test.ts`) but reports
  **NOT RUN** until the writer exists.
- **Gate 1:** NOT RUN. `samples/out/` has no GLB, so none of the 6 checks ran.
- **ecctrl:** not built. It's a react-three-fiber controller, and this
  sample is plain three.js. It's documented as the next step in
  site/docs/dramatis-three.md.
- **Live-update cost at full mesh size** (about 14k body vertices plus
  garments) isn't measured. The update path rewrites arrays in place and
  recomputes the bounds, but the builder's rebuild time will dominate, and
  it doesn't exist yet.

## Found on the way (for other lanes)

- **The `dramatis` tarball has no `dist/`.** `package.json` has no `files`
  field, so npm falls back to `.gitignore`, which excludes `dist/`. The
  packed tarball (case E) has `src/`, `test/`, `site/` and the rest of the
  repo, but neither entry's built JS, so `dramatis/three` would not resolve
  for an adopter. It needs a `files` list (and a check on the packed
  tarball, like tosijs-3d's `smoke-consumer.ts`) before any publish. That is
  a package.json change, which is the docs/release owner's, so this lane
  didn't make it.
- `tosijs` is a non-optional peer of tosijs-3d that the pure subpaths never
  import. It costs 0.85 MB to download and 3 MB on disk. Stage B's package
  should drop it too.
