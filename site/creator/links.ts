// Where the creator points people: the intro dialog (element.ts) and the
// Dramatis menu on the scene's bar (app.ts) both list these. Site paths are
// relative to the site root; the tosijs-3d builder is on its own site.

export interface CreatorLink {
  label: string
  href: string
  /** A line for the intro dialog. */
  note: string
}

export const DEMO_LINKS: CreatorLink[] = [
  {
    label: 'three.js demo',
    href: '/demo/',
    note: 'walk an exported character round a three.js scene',
  },
  {
    label: 'Unity demo',
    href: '/unity/',
    note: "the same in Unity 6's Web player",
  },
  {
    label: 'three.js viewer',
    href: '/viewer/',
    note: 'open any GLB and play its clips',
  },
]

export const TOSIJS_3D_BUILDER: CreatorLink = {
  label: 'tosijs-3d character builder',
  href: 'https://3d.tosijs.net/character-builder/',
  note: 'everything this is built on, working in tosijs-3d (more bodies, tailoring, rigging)',
}

export const DOC_LINKS: CreatorLink[] = [
  {
    label: 'Documentation',
    href: '/docs/',
    note: 'the export format and a guide per engine',
  },
  {
    label: 'Licences',
    href: '/licences/',
    note: 'every asset and its licence',
  },
]

/** Opens a link in a new tab, so the character being made stays put. */
export function openLink(href: string): void {
  window.open(href, '_blank', 'noopener')
}
