# Dramatis

An open 3D character creator for the web. CC0 base data, GLB and VRM out, works in any engine, and nobody can buy it and switch it off. See [PLAN.md](PLAN.md).

Status: in development. The creator exists today as tosijs-3d's [character builder](https://3d.tosijs.net/character-builder/) and Dramatis is the product built on it. The site will live at [dramatis.tosijs.net](https://dramatis.tosijs.net).

## Layout

| Path | What |
| --- | --- |
| `src/index.ts` | `dramatis`: the engine-free core API (no DOM, no Babylon, no three.js) |
| `src/three/` | `dramatis/three`: the three.js embed (`three` is a peer dependency) |
| `src/upstream/` | General pieces built here and moved into tosijs-3d before they ship; never exported (see its README) |
| `src/no-babylon.test.ts` | Bundles both entries for the browser and fails if Babylon reaches the output, the emitted `.d.ts`, or its type closure |
| `site/` | The site: `config.ts` (tosijs-ui doc system), `hydrate.ts` (bundle entry), `docs/` (pages), `static/`, `CNAME` |
| `bin/site.ts` | Builds and serves the site |
| `samples/` | Per-engine sample projects, the export gate's harness |
| `reports/` | Evidence from spikes and checks |
| `test/fixtures/` | Deliberate failure cases for the guards |

## Commands

| Command | Does |
| --- | --- |
| `bun install` | Install (tosijs-3d is pinned exactly, at 0.11.6) |
| `bun test` | The unit suite, including the no-Babylon check |
| `bun run typecheck` | `tsc --noEmit`, strict |
| `bun run check` | Typecheck, formatting check, tests |
| `bun run format` | Prettier (markdown is excluded by `requirePragma`) |
| `bun run build` | Build the site to `www/` and the library to `dist/` |
| `bun start` | Build the site, then serve it with live rebuilds (HTTPS: run `bun run tls` once first; needs mkcert) |
| `bun run stop` | Stop this project's dev server, and nothing else |

CI (`.github/workflows/ci.yml`) runs the tests, typecheck, formatting and build. `.github/workflows/pages.yml` builds the site and deploys it to GitHub Pages; Pages must be set to deploy from GitHub Actions.

Bun is pinned in `.bun-version` to 1.4.2, the version installed where this was scaffolded, though the shared practices name 1.3.14. Nothing is known to break on 1.4.2.

## Licence

Apache-2.0 ([LICENSE](LICENSE)), to match tosijs-3d. **This is an owner decision still to confirm.** The package is `private` until it is.

Every shipped asset carries its own known licence, stated on the site and carried into exports (MakeHuman's CC0 data, reimplemented from the file formats; no MakeHuman code).
