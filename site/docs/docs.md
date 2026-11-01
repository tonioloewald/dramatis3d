# Documentation

<!--{"pin": "top", "order": 1}-->

The Dramatis docs. Each page is a markdown file in `site/docs/` and joins this
section by declaring `"parent": "docs"` in its metadata line, with an `order`
to place it. (Name the file for its slug: pages are served at `/<filename>/`.)

## The library

- [Dramatis core](/dramatis-core/): the engine-free API, starting with the
  character file.
- [dramatis/three](/dramatis-three/): the three.js embed.

## Coming

These pages arrive with the work they describe (see PLAN.md):

- Quick start: make a character and export it.
- The character file format (`tosijs-character`).
- Import guides, one per engine: three.js, Babylon, Unity, Godot, Unreal 5.
- Asset licences: every shipped asset, its source and its licence.

<!-- toc -->
- [Dramatis core](/dramatis-core/)
- [dramatis/three](/dramatis-three/)
<!-- /toc -->
