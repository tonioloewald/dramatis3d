# Dramatis

An open 3D character creator for the web. CC0 base data, GLB and VRM out, works in any engine, and nobody can buy it and switch it off. See [PLAN.md](PLAN.md).

**Status: in development, not released.** Version 0.0.0; the package is `private` and not on npm. The site is built for [dramatis.tosijs.net](https://dramatis.tosijs.net). What works today:

- **The creator** (`/creator/`): shape and dress a MakeHuman body on tosijs-3d's character system, then **Download GLB**, **View in three.js**, or make a **Share link**.
- **The three.js viewer** (`/viewer/`): opens any GLB, plays Quaternius' UAL clips on it by name, drives the face units and lists the licences.
- **The library**: `buildCharacter`, `exportCharacterGlb`, `exportCharacterVrm` (VRM 1.0, library only, no creator button yet), share links, the licence manifest, and `dramatis/three` for live three.js objects.

Where the export has been checked (on the four samples in `samples/out/`, headless, default import settings; evidence in [reports/spike-1.md](reports/spike-1.md)):

| Engine | Status |
| --- | --- |
| three.js 0.186 | Verified: gate 1 (`bun run gate1`) and the viewer in headless Chromium |
| Godot 4.5 | Verified: headless import and checks, rendered frames |
| Babylon.js 9.33 | Verified on a `NullEngine` (nothing rendered) |
| Blender 5.2 | Verified (a second opinion, no guide) |
| Unity | **Not run**: no Unity editor installed. Project and batch command written |
| Unreal 5 | **Not run**: no Unreal installed. A manual procedure is written |

Not judged yet: how a character looks on a real GPU, VRM in a VTuber app, browsers other than Chromium. Known gaps (no baked skin or eye textures, Quaternius hair does not export, shoe soles below the floor) are listed on the [Export](site/docs/export.md) page.

## Layout

| Path | What |
| --- | --- |
| `src/index.ts` | `dramatis`: the engine-free core API (no DOM, no Babylon, no three.js) |
| `src/three/` | `dramatis/three`: the three.js embed (`three` is a peer dependency) |
| `src/contracts/` | The types and signatures the lanes build against ([LANES.md](LANES.md)); the GLB profile's names (`profile.ts`) |
| `src/build/` | `buildCharacter` and the GLB writer (`writeCharacterGlb`, `exportCharacterGlb`) |
| `src/vrm/` | The VRM 1.0 export |
| `src/share/`, `src/licences/` | Share links; the asset licence manifest |
| `src/upstream/` | General pieces built here and moved into tosijs-3d before they ship; never exported (see its README) |
| `src/no-babylon.test.ts` | Bundles both entries for the browser and fails if Babylon reaches the output, the emitted `.d.ts`, or its type closure |
| `site/` | The site: `config.ts` (tosijs-ui doc system), `hydrate.ts` (bundle entry), `docs/` (pages), `creator/`, `viewer/`, `static/`, `CNAME` |
| `bin/` | `site.ts` (build and serve), `export-sample.ts` (write `samples/out/`), `extremes.ts` (the extremes sweep) |
| `samples/` | `out/` (the sample exports), `three/`, `three-glb/`, `godot/`, `unity/` |
| `test/gate1/` | The gate-1 harness: six profile checks on every GLB in `samples/out/` |
| `tools/engines/` | Spike 1's engine checks: Godot, Blender, Babylon, Unity |
| `reports/` | Evidence from spikes and checks |
| `test/fixtures/` | Deliberate failure cases for the guards |

## Commands

| Command | Does |
| --- | --- |
| `bun install` | Install (tosijs-3d is pinned exactly, at 0.11.6) |
| `bun test` | The unit suite, including the no-Babylon check. Network, browser and engine tests are skipped (and say NOT RUN) unless enabled below |
| `bun run typecheck` | `tsc --noEmit`, strict |
| `bun run check` | Typecheck, formatting check, tests |
| `bun run gate1` | The gate-1 profile checks on `samples/out/` |
| `bun bin/export-sample.ts` | Re-export the samples in `samples/out/` |
| `bun run test-consumer` | Pack the tarball, install it with three and without Babylon, import both entries under node and bun |
| `bun run format` | Prettier (markdown is excluded by `requirePragma`) |
| `bun run build` | Build the site to `www/` (and `llms.txt`) and the library to `dist/` |
| `bun start` | Build the site, then serve it with live rebuilds (HTTPS: run `bun run tls` once first; needs mkcert) |
| `bun run stop` | Stop this project's dev server, and nothing else |

Test tiers: `DRAMATIS_NETWORK=1` adds the tests that fetch the pack from `cdn.tosijs.net`; `DRAMATIS_BROWSER=1` adds headless Chromium (`bunx playwright-core install chromium` once, and `bun run build` first); `DRAMATIS_ENGINES=1 bun test tools/engines` runs the installed engines.

CI (`.github/workflows/ci.yml`) runs the typecheck, formatting, tests, gate 1, the packed-tarball smoke and the build, plus the network tier and the headless-browser tier (each fails if its tier skipped anything). The engine tier stays manual. `.github/workflows/pages.yml` runs CI as its first job and deploys the site to GitHub Pages only if it passes; Pages must be set to deploy from GitHub Actions.

Bun is pinned in `.bun-version` to 1.4.2, the version installed where this was scaffolded, though the shared practices name 1.3.14. Nothing is known to break on 1.4.2.

## Licence

Apache-2.0 ([LICENSE](LICENSE)), to match tosijs-3d. **This is an owner decision still to confirm.** The package is `private` until it is.

Every shipped asset carries its own known licence, stated on the site and carried into exports (MakeHuman's CC0 data, reimplemented from the file formats; no MakeHuman code). The full list is the [licences page](site/docs/licences.md).
