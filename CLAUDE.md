# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dramatis: an open 3D character creator for the web, and the engine-agnostic library under it.
CC0 base data (MakeHuman), GLB and VRM out, works in any engine. **Read `PLAN.md` first.**
Nothing is built here yet. The creator builds on tosijs-3d's character system, which stays there.

This project follows the shared practices in
[tosijs-coding-practices](../tosijs-coding-practices/README.md). Read its README first and
honour the assumed stack. Work is tracked on the virta board (project `dramatis3d`).

## Status and where things live

No code, `package.json`, build or tests yet: the repo is `PLAN.md`. When code arrives it
follows the assumed stack (Bun for install/run/test/build, TypeScript strict); add the real
commands here then.

Most of what Dramatis is built on lives in sibling checkouts, so read it there:

- `../tosijs-3d`: the character system (modules named in PLAN.md "Where it starts"), the
  pure-subpath checks (`src/no-dom.test.ts`, `bin/smoke-consumer.ts`). The design record
  `CHARACTER-DESIGN.md` is only on its `character-design` branch, not main.
- `../static-assets`: builds the CDN packs (`bin/makehuman-pack.ts`).
- `../tosijs-3d-ensemble`: downstream; it depends on Dramatis.

## Invariants (from PLAN.md)

- **Dramatis consumes tosijs-3d, never the reverse, and never takes anything out of it.** The
  character system, biped controller and rigging stay there. General work (the skinned GLB
  writer, baked materials, the extremes sweep) is built in tosijs-3d: file it as an issue
  there, don't edit it from here. It may be *prototyped* here under `src/upstream/` and
  moved before it ships (PLAN.md "Shape"). tosijs-3d-ensemble depends on Dramatis.
- **The embeds use only tosijs-3d's pure subpaths** (PLAN.md "The engine-free core"). A
  three.js bundle with Babylon in it is a failed build.
- **One character file:** `tosijs-character`, read and written through tosijs-3d.
- **Export is the launch gate.** A feature that doesn't survive export into the five engines
  (three.js, Babylon, Unity, Godot, Unreal 5) isn't done.
- **Every shipped asset has a known licence**, stated on the page and carried into exports.
  MakeHuman: use their CC0 data, reimplement their logic from the file formats, copy no code
  (their code is AGPL). Community assets are checked one by one.
- **Paid features never touch the file format,** and nothing free moves behind a paywall.
