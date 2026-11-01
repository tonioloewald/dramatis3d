#!/usr/bin/env bun
/*
WRITE THE MANIFEST INTO site/docs/licences.md, between its
`<!-- manifest -->` and `<!-- /manifest -->` markers, so the page shows
exactly what the code ships. licences.test.ts fails when the page is stale.

  bun src/licences/write-page.ts
*/

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { COMMUNITY, MANIFEST } from './manifest'

export const PAGE = join(
  import.meta.dir,
  '..',
  '..',
  'site',
  'docs',
  'licences.md'
)
const START = '<!-- manifest -->'
const END = '<!-- /manifest -->'

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const link = (text: string, url: string) =>
  url ? `[${cell(text)}](${url})` : cell(text)

/** The generated part of the page. */
export function manifestMarkdown(): string {
  const out: string[] = []
  const groups = new Map<string, (typeof MANIFEST)[number][]>()
  for (const e of MANIFEST) {
    const source = e.asset.split(':')[0]!
    groups.set(source, [...(groups.get(source) ?? []), e])
  }
  const GROUP_TITLE: Record<string, string> = {
    makehuman: 'MakeHuman (core and system assets)',
    monk: 'Monk Skin Tone Scale',
    quaternius: 'Quaternius',
    blender: 'Blender Studio',
  }
  out.push(
    `**${MANIFEST.length} assets shipped**, every one listed here with its source and licence. ` +
      `**${COMMUNITY.length} community assets** are in the packs but unchecked, so they are excluded (below).`,
    ''
  )
  for (const [source, entries] of groups) {
    out.push(`### ${GROUP_TITLE[source] ?? source}`, '')
    out.push('| Asset | What | Kind | Licence | Author | Source |')
    out.push('| --- | --- | --- | --- | --- | --- |')
    for (const e of entries)
      out.push(
        `| \`${e.asset}\` | ${cell(e.title)}${
          e.modified ? ' (modified)' : ''
        } | ${e.kind} | ${link(e.licence, e.licenceUrl)} | ${cell(
          e.author
        )} | ${link('source', e.source)} |`
      )
    out.push('')
    const credits = entries.filter((e) => e.attribution)
    for (const e of credits)
      out.push(`> **Credit:** ${cell(e.attribution!)}`, '')
  }
  out.push('### Community assets: unchecked, excluded', '')
  out.push(
    "What each one's pack declares is shown as declared, not as checked. None of these ships " +
      'or exports until a person has checked it and it moves into the manifest.',
    ''
  )
  out.push(
    '| Asset | Kind | Pack | Declared licence | Declared author | Page |'
  )
  out.push('| --- | --- | --- | --- | --- | --- |')
  for (const c of COMMUNITY)
    out.push(
      `| \`${c.asset}\` | ${c.kind} | ${link(c.pack, c.packUrl)} | ${cell(
        c.declared?.license ?? 'none declared'
      )} | ${cell(c.declared?.author ?? '')} | ${
        c.declared?.source ? link('page', c.declared.source) : ''
      } |`
    )
  out.push('')
  return out.join('\n')
}

/** The page with its generated part replaced. */
export function renderPage(page: string): string {
  const a = page.indexOf(START)
  const b = page.indexOf(END)
  if (a < 0 || b < a) throw new Error(`${PAGE}: no ${START} … ${END} markers`)
  return `${page.slice(
    0,
    a + START.length
  )}\n\n${manifestMarkdown()}\n${page.slice(b)}`
}

if (import.meta.main) {
  const page = readFileSync(PAGE, 'utf8')
  writeFileSync(PAGE, renderPage(page))
  console.log(`wrote the manifest into ${PAGE}`)
}
