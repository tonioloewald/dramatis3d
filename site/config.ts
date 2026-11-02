// Site configuration for the Dramatis site (landing page + docs + demo).
// Consumed by bin/site.ts. See tosijs-ui/site for the full option set; this is
// modelled on tosijs-3d's site.config.ts.

import { defineSiteConfig } from 'tosijs-ui/site'
import { buildCreatorApp, CREATOR_STATIC } from './creator/build'

// One source for the custom domain: site/CNAME. GitHub Pages reads the CNAME the
// build writes into the output; deriving `domain` from this file keeps them equal.
const DOMAIN = (
  await Bun.file(new URL('./CNAME', import.meta.url)).text()
).trim()

export default defineSiteConfig({
  name: 'Dramatis',
  description:
    'An open 3D character creator for the web: CC0 base data, GLB and VRM out, works in any engine.',
  baseUrl: `https://${DOMAIN}`,
  domain: DOMAIN,
  favicon: '/favicon.svg',

  projectLinks: {
    github: 'https://github.com/tonioloewald/dramatis3d',
  },
  navbarLinks: [
    { href: 'https://3d.tosijs.net', label: 'tosijs-3d' },
    {
      href: 'https://github.com/tonioloewald/dramatis3d',
      label: 'github',
      icon: 'github',
    },
  ],

  theme: {
    accent: '#7a4bd6',
    background: '#fafafa',
    text: '#222222',
  },

  // Pages are markdown in site/docs/; the landing page claims the root
  // (`{"home": true}` in site/docs/landing.md). README is repo-facing (its links
  // point at repo files) and stays off the site. src/upstream/ is never
  // documented here: it is not Dramatis's API.
  docPaths: ['site/docs'],

  // Prose site: fenced code is illustration unless a fence opts in (```js:inline).
  liveExamples: 'opt-in',

  docsJson: 'site/docs.json',
  bundleEntry: './site/hydrate.ts',
  watchPaths: ['site/hydrate.ts', 'site/creator'],
  // The creator's heavy half (Babylon) is its own bundle, loaded only by the
  // creator page: built first, then copied in as /creator-app/.
  prebuild: async () => {
    if (!(await buildCreatorApp())) throw new Error('creator bundle failed')
  },
  staticDirs: ['site/static', CREATOR_STATIC],
  // Built for GitHub Pages by .github/workflows/pages.yml; not committed.
  outputDir: 'www',
  host: 'github-pages',
  port: 8040,

  // The library: bun build bundles the public entries into dist/ (dependencies and
  // peers stay imports), tsc emits their declarations (tsconfig.build.json).
  libraryBundle: {
    entries: ['src/index.ts', 'src/three/index.ts'],
    tsconfig: 'tsconfig.build.json',
  },

  // Live examples import `dramatis` / `tosijs-3d`, seeded in site/hydrate.ts; the
  // build-time checker only knows tosijs / tosijs-ui (same reason as tosijs-3d).
  checkExamples: false,
})
