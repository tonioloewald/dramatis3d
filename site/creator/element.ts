// <dramatis-creator>: the creator's light half, in the site's shared bundle.
//
// It paints an empty stage at once, filling the page's content area, then
// loads the heavy half (app.ts: Babylon, tosijs-3d's character, the export
// actions), a separate bundle built by site/creator/build.ts and served at
// CREATOR_APP_URL. Pages without the element never fetch it.
//
// The export actions live here (they open the viewer's tab inside the click,
// and report in the status line), but their controls are the scene's own:
// the Export menu on the system bar (app.ts) calls `shell.act`. A first visit
// gets a short intro over the stage (`about`), which the Dramatis menu shows
// again.

import type { NamingProfile } from '../../src/contracts/profile'
import type { CreatorApp, CreatorShell } from './app'
import { DEMO_LINKS, DOC_LINKS, TOSIJS_3D_BUILDER } from './links'
import { onSmallDevice, PHONE_NOTE } from './phone'

/** Where build.ts puts the heavy half, from the site root. */
export const CREATOR_APP_PATH = '/creator-app/app.js'
/** The creator's own page, for share links made on other origins (dev). */
export const CREATOR_PAGE = 'https://dramatis.tosijs.net/creator/'
/** Set once the intro has been closed, so it shows on a first visit only. */
export const INTRO_SEEN_KEY = 'dramatis-creator-intro-seen'

/** What the Export menu can ask of the shell. */
export type CreatorAction = 'view' | 'unity' | 'download' | 'vrm' | 'share'

const STYLE = `
dramatis-creator { position: relative; display: flex; width: 100%; height: 80vh; max-width: none;
  min-height: 420px; margin: 0 0 24px; --dc-accent: #8c6239; }
@media (prefers-color-scheme: dark) { dramatis-creator { --dc-accent: #c69d6d; } }
dramatis-creator .dc-stage { position: relative; flex: 1; min-width: 0; border-radius: 8px;
  overflow: hidden; background: #2a3340; display: flex; }
dramatis-creator .dc-wait { margin: auto; color: #d8dde6; text-align: center; padding: 16px; }
dramatis-creator .dc-status { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%);
  max-width: min(90%, 640px); padding: 8px 14px; border-radius: 8px; font-size: 0.92em;
  background: rgba(20, 24, 32, 0.88); color: #e8ecf2; overflow-wrap: anywhere; z-index: 2;
  box-shadow: 0 2px 10px rgba(0,0,0,0.35); cursor: default; }
dramatis-creator .dc-status:empty { display: none; }
dramatis-creator .dc-status.dc-error { background: rgba(110, 22, 18, 0.92); }
dramatis-creator .dc-status a { color: #9cc7ff; word-break: break-all; }
dramatis-creator .dc-intro { position: absolute; inset: 0; z-index: 3; display: flex;
  align-items: center; justify-content: center; padding: 16px; border-radius: 8px;
  background: rgba(16, 20, 28, 0.55); }
dramatis-creator .dc-intro[hidden] { display: none; }
dramatis-creator .dc-card { max-width: 30em; max-height: 100%; overflow: auto; padding: 20px 24px;
  border-radius: 10px; background: #f7efe3; color: #2b2118; box-shadow: 0 6px 30px rgba(0,0,0,0.4);
  font-size: 0.95em; line-height: 1.45; }
@media (prefers-color-scheme: dark) { dramatis-creator .dc-card { background: #2b2620; color: #ece3d6; } }
dramatis-creator .dc-card h2 { margin: 0 0 8px; font-size: 1.6em; color: var(--dc-accent); border: 0; }
dramatis-creator .dc-card p { margin: 0 0 10px; }
dramatis-creator .dc-card ul { margin: 0 0 14px; padding-left: 1.2em; }
dramatis-creator .dc-card li { margin: 2px 0; }
dramatis-creator .dc-card a { color: var(--dc-accent); }
dramatis-creator .dc-card button { padding: 6px 18px; font: inherit; cursor: pointer; border-radius: 6px;
  border: 1px solid var(--dc-accent); background: var(--dc-accent); color: #fff; }
@media (prefers-color-scheme: dark) { dramatis-creator .dc-card button { color: #1a1612; } }
.dc-visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; }
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

const seen = (): boolean => {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    // A private window: it shows again next visit, which is harmless.
  }
}

export class DramatisCreator extends HTMLElement {
  private app: CreatorApp | null = null
  private mounting = false
  private working = false
  private name = ''
  private naming: NamingProfile = 'ue'
  private statusEl = h('div', { className: 'dc-status', role: 'status' })
  private statusTimer: ReturnType<typeof setTimeout> | undefined
  private introEl = h('div', { className: 'dc-intro', hidden: true })
  private fit = () => this.fitHeight()
  private watcher: ResizeObserver | null = null
  private watched: HTMLElement | null = null
  /** Ancestors whose clipping was loosened, with what they had. */
  private unclipped: Array<[HTMLElement, string]> = []

  connectedCallback() {
    if (this.app || this.mounting) return
    if (!document.getElementById('dramatis-creator-style'))
      document.head.append(
        h('style', { id: 'dramatis-creator-style', textContent: STYLE })
      )
    // The page's heading names it in the nav; on the page the creator is
    // the whole content area, so the heading is kept for screen readers only.
    this.heading()?.classList.add('dc-visually-hidden')
    const stage = h(
      'div',
      { className: 'dc-stage' },
      h('div', {
        className: 'dc-wait',
        textContent:
          'Loading the creator (3D engine and body data, a few MB the first time)…',
      })
    )
    this.statusEl.addEventListener('click', (e) => {
      if (!(e.target instanceof HTMLAnchorElement)) this.status(false)
    })
    this.buildIntro()
    this.replaceChildren(stage, this.statusEl, this.introEl)
    if (!seen()) this.about()
    window.addEventListener('resize', this.fit)
    requestAnimationFrame(this.fit)
    // The doc browser may still be placing the page on the first frame.
    setTimeout(this.fit, 250)
    void this.mount(stage)
  }

  disconnectedCallback() {
    // The doc browser swaps pages in place: let the scene go with the page.
    window.removeEventListener('resize', this.fit)
    this.watcher?.disconnect()
    this.watcher = null
    this.watched = null
    for (const [n, overflow] of this.unclipped.splice(0))
      n.style.overflow = overflow
    clearTimeout(this.statusTimer)
    this.app?.dispose()
    this.app = null
  }

  /** The heading just above the creator, if the page has one. */
  private heading(): HTMLElement | null {
    for (let n: Element | null = this; n; n = n.parentElement) {
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.tagName === 'H1') return s as HTMLElement
        if (s.textContent?.trim()) return null
      }
      if (n.parentElement?.tagName === 'MAIN') return null
    }
    return null
  }

  /** The page's scrolling content pane (beside the sidebar), or the window. */
  private pane(): HTMLElement | null {
    for (let n = this.parentElement; n; n = n.parentElement) {
      const y = getComputedStyle(n).overflowY
      if (y === 'auto' || y === 'scroll') return n
    }
    return null
  }

  /**
   * THE CONTENT AREA, FILLED: as wide as the pane (the article around it is
   * kept to a reading width, so the creator reaches past it on both sides)
   * and from its top to the pane's bottom.
   */
  private fitHeight() {
    if (!this.isConnected) return
    const pane = this.pane()
    // The pane changes width without the window (the sidebar folding).
    if (
      pane &&
      pane !== this.watched &&
      typeof ResizeObserver !== 'undefined'
    ) {
      this.watcher?.disconnect()
      this.watcher = new ResizeObserver(this.fit)
      this.watcher.observe(pane)
      this.watched = pane
    }
    // Between it and the pane, the article clips to a reading width.
    for (let n = this.parentElement; n && n !== pane; n = n.parentElement)
      if (
        getComputedStyle(n).overflowX !== 'visible' &&
        !this.unclipped.some(([u]) => u === n)
      ) {
        this.unclipped.push([n, n.style.overflow])
        n.style.overflow = 'visible'
      }
    const box = pane?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: document.documentElement.clientWidth,
      bottom: window.innerHeight,
    }
    const gutter = 12
    const host = this.parentElement!
    // A margin counts from the parent's content box, inside its padding.
    const parentLeft =
      host.getBoundingClientRect().left +
      (parseFloat(getComputedStyle(host).paddingLeft) || 0)
    const width = Math.max(320, (pane?.clientWidth ?? box.width) - 2 * gutter)
    this.style.width = `${Math.round(width)}px`
    this.style.marginLeft = `${Math.round(box.left + gutter - parentLeft)}px`
    const scrolled = pane ? pane.scrollTop : window.scrollY
    const top = this.getBoundingClientRect().top + scrolled - box.top
    const room = box.bottom - box.top - top - gutter
    this.style.height = `${Math.max(420, Math.round(room))}px`
  }

  private buildIntro() {
    const link = (l: { label: string; href: string; note: string }) =>
      h(
        'li',
        {},
        h('a', {
          href: l.href,
          textContent: l.label,
          target: '_blank',
          rel: 'noopener',
        }),
        `: ${l.note}`
      )
    const start = h('button', { type: 'button', textContent: 'Start' })
    const close = () => {
      markSeen()
      this.introEl.hidden = true
    }
    start.addEventListener('click', close)
    this.introEl.addEventListener('click', (e) => {
      if (e.target === this.introEl) close()
    })
    this.introEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close()
    })
    this.introEl.setAttribute('role', 'dialog')
    this.introEl.setAttribute('aria-modal', 'false')
    this.introEl.setAttribute('aria-labelledby', 'dc-intro-title')
    this.introEl.append(
      h(
        'div',
        { className: 'dc-card' },
        h('h2', { id: 'dc-intro-title', textContent: 'Dramatis' }),
        h('p', {
          textContent:
            'An open 3D character creator for the web. Shape a body, dress it, ' +
            'give it something to hold, then export it as a GLB or VRM that works ' +
            'in three.js, Unity, Godot and other engines, its licences inside.',
        }),
        h('p', {
          textContent:
            'The panel shapes the character, a tab per part. The menus at the top ' +
            'left of the scene export it, share it as a link, and lead to the demos. ' +
            'Your characters stay in this browser; there are no accounts.',
        }),
        h(
          'ul',
          {},
          ...[...DEMO_LINKS, TOSIJS_3D_BUILDER, ...DOC_LINKS].map(link)
        ),
        start
      )
    )
    queueMicrotask(() => {
      if (!this.introEl.hidden) start.focus({ preventScroll: true })
    })
  }

  /** Show the intro (on a first visit, and from the Dramatis menu). */
  about() {
    this.introEl.hidden = false
    this.introEl.querySelector('button')?.focus({ preventScroll: true })
  }

  private status(
    message: string | false,
    tone: 'info' | 'error' = 'info',
    link?: string
  ) {
    clearTimeout(this.statusTimer)
    this.statusEl.className = `dc-status${tone === 'error' ? ' dc-error' : ''}`
    this.statusEl.replaceChildren()
    if (message === false) return
    this.statusEl.append(message)
    if (link)
      this.statusEl.append(' ', h('a', { href: link, textContent: link }))
    // A note fades on its own; an error, a link, or work in progress stays
    // until the next message (or a click on it).
    if (tone === 'info' && !link && message !== 'Working…')
      this.statusTimer = setTimeout(() => this.status(false), 6000)
  }

  private shell(): CreatorShell {
    return {
      name: () => this.name,
      setName: (name) => {
        this.name = name
      },
      naming: () => this.naming,
      setNaming: (n) => {
        this.naming = n
      },
      status: (m, tone) => this.status(m, tone),
      shareBase: () =>
        /^https?:$/.test(location.protocol) &&
        location.pathname.startsWith('/creator')
          ? `${location.origin}${location.pathname}`
          : CREATOR_PAGE,
      act: (action) => this.act(action),
      about: () => this.about(),
    }
  }

  /** Run one of the Export menu's actions (also for tests and agents). */
  act(action: CreatorAction) {
    if (action === 'view' || action === 'unity') return this.view(action)
    if (action === 'download') return void this.run((a) => a.download())
    if (action === 'vrm') return void this.run((a) => a.vrm())
    return void this.run((a) => a.share())
  }

  private async mount(stage: HTMLElement) {
    this.mounting = true
    const started = performance.now()
    const note = onSmallDevice(globalThis.matchMedia)
    if (note) this.status(PHONE_NOTE)
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
      this.dataset.ready = ''
      if (note && this.statusEl.textContent === PHONE_NOTE) this.status(false)
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
    if (!this.app) return this.status('The creator is still loading.')
    if (this.working) return this.status('Still working on the last one…')
    this.working = true
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
      this.working = false
    }
  }

  private view(where: 'view' | 'unity') {
    if (!this.app) return this.status('The creator is still loading.')
    if (this.working) return this.status('Still working on the last one…')
    // Opened now, in the click, or the browser blocks it as a pop-up.
    const opened = window.open('about:blank', '_blank')
    try {
      opened?.document.write(
        '<title>Dramatis</title><p style="font:16px system-ui;padding:2em">Exporting your character…</p>'
      )
    } catch {
      // Not ours to write to: it is pointed at the page when it is ready.
    }
    void this.run((a) => a[where](opened))
  }
}

if (!customElements.get('dramatis-creator'))
  customElements.define('dramatis-creator', DramatisCreator)
