// Site configuration for the Dramatis site (landing page + docs + demo).
// Consumed by bin/site.ts. See tosijs-ui/site for the full option set; this is
// modelled on tosijs-3d's site.config.ts.

import { defineSiteConfig, type Doc } from 'tosijs-ui/site'
import { buildCreatorApp, CREATOR_STATIC } from './creator/build'
import { buildViewer, VIEWER_STATIC } from './viewer/build'

// One source for the custom domain: site/CNAME. GitHub Pages reads the CNAME the
// build writes into the output; deriving `domain` from this file keeps them equal.
const DOMAIN = (
  await Bun.file(new URL('./CNAME', import.meta.url)).text()
).trim()

const NAME = 'Dramatis'
const DESCRIPTION =
  'An open 3D character creator for the web: CC0 base data, GLB and VRM out, works in any engine.'
const GITHUB = 'https://github.com/tonioloewald/dramatis3d'

// llms.txt, grouped as the docs index groups the pages (site/docs/docs.md).
// Every published page must be placed here and carry a "description" in its
// metadata line: the build fails otherwise, so a new page cannot slip in
// unindexed. (tosijs-ui's default index lists pages alphabetically with
// their first line cut at 120 characters, says the docs have live examples
// this site does not have, and links npm, where Dramatis is not published.)
const LLMS_SECTIONS: Array<[string, string[]]> = [
  ['Start', ['landing.md', 'creator.md', 'docs.md']],
  ['The file you export', ['export.md', 'export-format.md', 'vrm.md']],
  [
    'Import guides (one per engine)',
    [
      'guide-threejs.md',
      'guide-godot.md',
      'guide-babylon.md',
      'guide-unity.md',
      'guide-unreal.md',
    ],
  ],
  ['The library', ['dramatis-core.md', 'dramatis-three.md']],
  ['The project', ['licences.md', 'extremes.md']],
]

function llmsTxt(corpus: Doc[]): string {
  const base = `https://${DOMAIN}`
  const docs = new Map(
    corpus
      .filter((d) => d.title && !d.hidden && !d.noindex)
      .map((d) => [d.filename, d])
  )
  const placed = new Set(LLMS_SECTIONS.flatMap(([, files]) => files))
  const unplaced = [...docs.keys()].filter((f) => !placed.has(f))
  if (unplaced.length)
    throw new Error(
      `llms.txt: place ${unplaced.join(', ')} in LLMS_SECTIONS (site/config.ts)`
    )
  const lines = [
    `# ${NAME}`,
    '',
    `> ${DESCRIPTION}`,
    '',
    'In development: version 0.0.0, not published to npm.',
    `The creator (${base}/creator/) exports GLB files.`,
    'Verified engines: three.js, Godot 4.5, Babylon.js 9.33 (headless).',
    'Not yet verified: Unity, Unreal Engine 5.',
    '',
    `- Docs: ${base}/docs/`,
    `- Creator: ${base}/creator/`,
    `- three.js viewer: ${base}/viewer/`,
    `- Source: ${GITHUB}`,
    '',
    'Each page below also has a plain markdown copy: append `index.md` to its',
    `URL (for example ${base}/export-format/index.md).`,
  ]
  for (const [section, files] of LLMS_SECTIONS) {
    lines.push('', `## ${section}`, '')
    for (const file of files) {
      const doc = docs.get(file)
      if (!doc) throw new Error(`llms.txt: no published page ${file}`)
      if (!doc.description)
        throw new Error(
          `llms.txt: ${file} has no "description" in its metadata`
        )
      const path = doc.home ? '/' : `/${file.replace(/\.md$/, '')}/`
      lines.push(`- [${doc.title}](${base}${path}): ${doc.description}`)
    }
  }
  return lines.join('\n') + '\n'
}

export default defineSiteConfig({
  name: NAME,
  description: DESCRIPTION,
  baseUrl: `https://${DOMAIN}`,
  domain: DOMAIN,
  favicon: '/favicon.svg',

  projectLinks: {
    github: GITHUB,
  },
  navbarLinks: [
    { href: 'https://3d.tosijs.net', label: 'tosijs-3d' },
    {
      href: GITHUB,
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
  llmsTxt,
  bundleEntry: './site/hydrate.ts',
  watchPaths: ['site/hydrate.ts', 'site/creator', 'site/viewer'],
  // The creator's heavy half (Babylon) is its own bundle, loaded only by the
  // creator page: built first, then copied in as /creator-app/.
  prebuild: async () => {
    if (!(await buildCreatorApp())) throw new Error('creator bundle failed')
    // The three.js viewer: its own page at /viewer/, three.js only.
    if (!(await buildViewer())) throw new Error('viewer bundle failed')
  },
  staticDirs: ['site/static', CREATOR_STATIC, VIEWER_STATIC],
  // Built for GitHub Pages by .github/workflows/pages.yml; not committed.
  outputDir: 'www',
  host: 'github-pages',
  // 8060 and its tunnel listener 8061 (port + 1) are used by no sibling project
  // (ariosto has 8040, tosijs-3d 8030/8031, the ensemble 8032).
  port: 8060,

  // Remote access: `bun run tunnel` (tosijs-ui's tosijs-tunnel) publishes THIS dev
  // server at an authenticated URL; a session is required even to view
  // (requireToken defaults to true). The host comes from PREVIEW_HOST
  // (~/local-secrets/tosijs-preview.env), never the repo. remotePort is pinned
  // because the name-derived one (9876) is taken; 9788/9789 are tosijs-3d and the
  // ensemble.
  preview: {
    host: process.env.PREVIEW_HOST ?? '',
    tunnel: { remotePort: 9790, url: 'https://dramatis.edit.dev.tosijs.net' },
  },

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
