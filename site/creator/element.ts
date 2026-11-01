// <dramatis-creator>: the creator's light half, in the site's shared bundle.
//
// It paints the toolbar and an empty stage at once, then loads the heavy half
// (app.ts: Babylon, tosijs-3d's character, the export actions), a separate
// bundle built by site/creator/build.ts and served at CREATOR_APP_URL. Pages
// without the element never fetch it.

import type { NamingProfile } from '../../src/contracts/profile'
import type { CreatorApp, CreatorShell } from './app'

/** Where build.ts puts the heavy half, from the site root. */
export const CREATOR_APP_PATH = '/creator-app/app.js'
/** The creator's own page, for share links made on other origins (dev). */
export const CREATOR_PAGE = 'https://dramatis.tosijs.net/creator/'

const STYLE = `
dramatis-creator { display: flex; flex-direction: column; gap: 8px; width: 100%;
  height: min(82vh, 900px); min-height: 480px; margin: 8px 0 24px; }
dramatis-creator .dc-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
dramatis-creator .dc-bar input { flex: 1 1 10em; min-width: 8em; padding: 6px 8px; font: inherit; }
dramatis-creator .dc-bar select { padding: 5px 6px; font: inherit; }
dramatis-creator .dc-bar button { padding: 6px 12px; font: inherit; cursor: pointer;
  border-radius: 6px; border: 1px solid #7a4bd6; background: #7a4bd6; color: #fff; }
dramatis-creator .dc-bar button.dc-quiet { background: transparent; color: #7a4bd6; }
dramatis-creator .dc-bar button:disabled { opacity: 0.45; cursor: progress; }
dramatis-creator .dc-status { min-height: 1.4em; font-size: 0.92em; overflow-wrap: anywhere; }
dramatis-creator .dc-status.dc-error { color: #b3261e; }
dramatis-creator .dc-status a { word-break: break-all; }
dramatis-creator .dc-stage { position: relative; flex: 1; min-height: 0; border-radius: 8px;
  overflow: hidden; background: #2a3340; display: flex; }
dramatis-creator .dc-wait { margin: auto; color: #d8dde6; text-align: center; padding: 16px; }
`

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  Object.assign(el, props)
  el.append(...children)
  return el
}

export class DramatisCreator extends HTMLElement {
  private app: CreatorApp | null = null
  private mounting = false
  private statusEl = h('div', { className: 'dc-status', role: 'status' })
  private nameEl = h('input', {
    type: 'text',
    placeholder: 'name your character',
    ariaLabel: 'character name',
  })
  private namingEl = h(
    'select',
    { ariaLabel: 'skeleton naming', title: 'Skeleton joint names in the GLB' },
    h('option', { value: 'ue', textContent: 'UE / UAL names' }),
    h('option', { value: 'mixamo', textContent: 'Mixamo names' })
  )
  private buttons: HTMLButtonElement[] = []

  connectedCallback() {
    if (this.app || this.mounting) return
    this.nameEl.oninput = () => this.app?.touched()
    if (!document.getElementById('dramatis-creator-style'))
      document.head.append(
        h('style', { id: 'dramatis-creator-style', textContent: STYLE })
      )
    const button = (
      label: string,
      title: string,
      run: () => void,
      quiet = false
    ) => {
      const b = h('button', {
        type: 'button',
        textContent: label,
        title,
        disabled: true,
        className: quiet ? 'dc-quiet' : '',
      })
      b.addEventListener('click', run)
      this.buttons.push(b)
      return b
    }
    const stage = h(
      'div',
      { className: 'dc-stage' },
      h('div', {
        className: 'dc-wait',
        textContent:
          'Loading the creator (3D engine and body data, a few MB the first time)…',
      })
    )
    this.replaceChildren(
      h(
        'div',
        { className: 'dc-bar' },
        this.nameEl,
        button(
          'View in three.js',
          'Export a GLB and open it in the three.js viewer',
          () => this.view()
        ),
        button('Download GLB', 'Export a GLB and save it', () =>
          this.run((a) => a.download())
        ),
        button(
          'Share link',
          'A link that opens this character here',
          () => this.share(),
          true
        ),
        this.namingEl
      ),
      this.statusEl,
      stage
    )
    void this.mount(stage)
  }

  disconnectedCallback() {
    // The doc browser swaps pages in place: let the scene go with the page.
    this.app?.dispose()
    this.app = null
  }

  private status(
    message: string | false,
    tone: 'info' | 'error' = 'info',
    link?: string
  ) {
    this.statusEl.className = `dc-status${tone === 'error' ? ' dc-error' : ''}`
    this.statusEl.replaceChildren()
    if (message === false) return
    this.statusEl.append(message)
    if (link)
      this.statusEl.append(' ', h('a', { href: link, textContent: link }))
  }

  private busy(on: boolean) {
    for (const b of this.buttons) b.disabled = on || !this.app
  }

  private shell(): CreatorShell {
    return {
      name: () => this.nameEl.value,
      setName: (name) => {
        this.nameEl.value = name
      },
      naming: () => this.namingEl.value as NamingProfile,
      status: (m, tone) => this.status(m, tone),
      shareBase: () =>
        /^https?:$/.test(location.protocol) &&
        location.pathname.startsWith('/creator')
          ? `${location.origin}${location.pathname}`
          : CREATOR_PAGE,
    }
  }

  private async mount(stage: HTMLElement) {
    this.mounting = true
    const started = performance.now()
    try {
      // A runtime URL, so the site bundler leaves the import alone.
      const url = new URL(CREATOR_APP_PATH, location.origin).href
      const mod = (await import(
        /* @vite-ignore */ url
      )) as typeof import('./app')
      stage.replaceChildren()
      const app = await mod.mountCreator(stage, this.shell())
      if (!this.isConnected) return app.dispose()
      this.app = app
      this.busy(false)
      console.info(
        `dramatis creator: ready in ${Math.round(
          performance.now() - started
        )} ms`
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.status(`The creator could not start: ${message}`, 'error')
    } finally {
      this.mounting = false
    }
  }

  private async run(
    action: (
      app: CreatorApp
    ) => Promise<{ ok: boolean; message: string; url?: string }>
  ) {
    if (!this.app) return
    this.busy(true)
    this.status('Working…')
    try {
      const r = await action(this.app)
      this.status(r.message, r.ok ? 'info' : 'error', r.url)
    } catch (e) {
      this.status(
        `Something went wrong: ${e instanceof Error ? e.message : e}`,
        'error'
      )
    } finally {
      this.busy(false)
    }
  }

  private view() {
    // Opened now, in the click, or the browser blocks it as a pop-up.
    const opened = window.open('about:blank', '_blank')
    try {
      opened?.document.write(
        '<title>Dramatis</title><p style="font:16px system-ui;padding:2em">Exporting your character…</p>'
      )
    } catch {
      // Not ours to write to: it is pointed at the viewer when it is ready.
    }
    void this.run((a) => a.view(opened))
  }

  private share() {
    void this.run((a) => a.share())
  }
}

if (!customElements.get('dramatis-creator'))
  customElements.define('dramatis-creator', DramatisCreator)
