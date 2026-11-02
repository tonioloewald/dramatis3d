# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dramatis: an open 3D character creator for the web, and the engine-agnostic library under it.
CC0 base data (MakeHuman), GLB and VRM out, works in any engine. **Read `PLAN.md` first.**
The creator builds on tosijs-3d's character system, which stays there. `LANES.md` maps the
code (who owns which paths, and the contracts in `src/contracts/`); `README.md` has the layout.

This project follows the shared practices in
[tosijs-coding-practices](../tosijs-coding-practices/README.md). Read its README first and
honour the assumed stack. Work is tracked on the virta board (project `dramatis3d`), not in
TODO.md; reviews are in `reviews/`, spike and run reports in `reports/`.

## Commands

- `bun run check`: typecheck + format check + tests. The definition of done for any change.
- `bun run gate1`: the export acceptance harness over `samples/out/` (validator, skeleton,
  morphs, licences, three.js load, a UAL clip that moves). `bun bin/export-sample.ts`
  regenerates the samples; re-run gate 1 after touching anything in the export path.
- `bun test path/to/file.test.ts` runs one file; `bun test -t "name"` one test.
- Opt-in tiers, skipped (and reported NOT RUN) by default: `DRAMATIS_NETWORK=1` (fetches the
  pack from cdn.tosijs.net), `DRAMATIS_BROWSER=1` (headless Chromium: `bunx playwright-core
  install chromium` once, `bun run build` first), `DRAMATIS_ENGINES=1 bun test tools/engines`
  (Godot, Blender, Babylon installed locally; Unity via `bun tools/engines/unity.ts`).
- `bun run build`: the site to `www/` and the library to `dist/`. `bun start` serves it with
  live rebuilds over HTTPS (run `bun run tls` once; needs mkcert); `bun run stop` stops it. Dev port 8060 (tunnel listener 8061).
  `bun run tunnel` exposes it at `dramatis.edit.dev.tosijs.net` (host from `PREVIEW_HOST` in
  `~/local-secrets/tosijs-preview.env`; `bun run tunnel --link` prints a login link).
- `bun run test-consumer`: packs the tarball, installs it with three and without Babylon, and
  imports both entries under node and bun. Run it before any publish.
- `bun run typecheck`, `bun run format` (`bun run format:check` in CI). Prettier never touches markdown.
- Bun is pinned to 1.4.2 in `.bun-version` (the practices name 1.3.14; nothing breaks on 1.4.2).

## Where things live

- `src/` is the engine-free core (`dramatis`); `src/three/` is `dramatis/three`. Both must stay
  free of `@babylonjs`, enforced by `src/no-babylon.test.ts`. The creator (`site/creator/`)
  and viewer (`site/viewer/`) are site code and may use Babylon or three freely.
- `src/upstream/` is general work bound for tosijs-3d, tracked as `upstream:tosijs-3d` tasks
  on the dramatis3d board. Don't file on tosijs-3d's board until the owner says so.
- Sibling checkouts, read-only from here: `../tosijs-3d` (the character system; import it only
  by public subpath, at the exact pinned version in `node_modules`), `../static-assets`
  (builds the CDN packs, and holds the per-pack licence JSONs), `../tosijs-3d-ensemble`
  (downstream: it depends on Dramatis). `CHARACTER-DESIGN.md` is on tosijs-3d's
  `character-design` branch only.
- Agent worktrees go in `.claude/worktrees/` (gitignored and prettier-ignored).

## Invariants (from PLAN.md)

- **Dramatis consumes tosijs-3d, never the reverse, and never takes anything out of it.** The
  character system, biped controller and rigging stay there. General work (the skinned GLB
  writer, baked materials, the extremes sweep) is built in tosijs-3d: file it as an issue
  there, don't edit it from here. It may be *prototyped* here under `src/upstream/` and
  moved before it ships (PLAN.md "Shape"). tosijs-3d-ensemble depends on Dramatis.
- **The embeds use only tosijs-3d's pure subpaths** (PLAN.md "The engine-free core"). A
  three.js bundle with Babylon in it is a failed build.
- **One character file:** `tosijs-character`, read and written through tosijs-3d.
- **Export is the launch gate.** A feature that doesn't survive export isn't done. The initial
  targets are three.js, Unity and Godot (owner, 2026-11-02); Babylon is checked where cheap and
  Unreal 5 is secondary. Never claim an engine works that `reports/spike-1.md` hasn't run.
- **Every shipped asset has a known licence**, stated on the page and carried into exports.
  MakeHuman: use their CC0 data, reimplement their logic from the file formats, copy no code
  (their code is AGPL). Community assets are checked one by one.
- **Paid features never touch the file format,** and nothing free moves behind a paywall.
