# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dramatis: an open 3D character creator for the web, and the engine-agnostic library under it.
CC0 base data (MakeHuman), GLB and VRM out, works in any engine. **Read `PLAN.md` first.**
Nothing is built here yet: the code is tosijs-3d's character builder, which moves here.

This project follows the shared practices in
[tosijs-coding-practices](../tosijs-coding-practices/README.md). Read its README first and
honour the assumed stack. Work is tracked on the virta board (project `dramatis3d`).

## Invariants (from PLAN.md)

- **Built on tosijs-3d; outputs are engine-free.** The creator runs on tosijs-3d. GLB/VRM
  export and the embeds (three.js first) use `dramatis/core`, which never pulls in Babylon.
  Export is written against the core, never through an engine's serializer.
- **Dramatis depends on tosijs-3d, never the reverse.** Changes tosijs-3d needs go to it as
  issues, not edits from here. tosijs-3d-ensemble depends on Dramatis.
- **Export is the launch gate.** A feature that doesn't survive export into the five engines
  (three.js, Babylon, Unity, Godot, Unreal 5) isn't done.
- **Every shipped asset has a known licence**, stated on the page and carried into exports.
  MakeHuman: use their CC0 data, reimplement their logic from the file formats, copy no code
  (their code is AGPL). Community assets are checked one by one.
- **The character file stays readable.** It is versioned (practices/state-and-schema.md); an
  older file migrates forward, and a `tosijs-character` v1 file must still load.
- **Paid features never touch the file format,** and nothing free moves behind a paywall.
