// THE PHONE BUDGET (#3654), held in CI's browser tier: each page on an
// emulated mid-range phone's CPU (4x slower), served as GitHub Pages serves
// it, must stay under its ceilings. Bytes are counted rather than timed over
// a throttled link, since CI's network is not a phone's: on slow 4G (about
// 0.2 MB/s) every MB is some 5 s of a first visit.
//
//   DRAMATIS_BROWSER=1 DRAMATIS_NETWORK=1 bun test tools/perf
//
// The creator and the demo fetch the CDN packs, so they need the network
// tier too. tools/perf/phone.ts measures the same with the link throttled.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Browser } from 'playwright-core'
import {
  buildSite,
  launch,
  measure,
  phoneContext,
  PROBES,
  serveSite,
  type PageCost,
} from './phone'

const BROWSER = process.env.DRAMATIS_BROWSER === '1'
const NETWORK = process.env.DRAMATIS_NETWORK === '1'
const MB = 2 ** 20

/**
 * The ceilings. Measured on an M-series Mac, 2026-11-03, and given room for
 * a slower CI runner; lower them when a page gets lighter, never raise one
 * without saying why here.
 *
 * - usefulMs: something to see or press (4x CPU, no link throttle).
 * - bytes: over the wire to ready, gzip as the host serves it.
 * - heap: the JS heap's peak to ready.
 */
export const BUDGET: Record<
  string,
  { usefulMs: number; bytes: number; heap: number; network: boolean }
> = {
  landing: { usefulMs: 4_000, bytes: 0.75 * MB, heap: 20 * MB, network: false },
  // 22.9 MB measured: 13.9 of it Quaternius' hair library, fetched at start by
  // tosijs-3d (#3774); the CDN's .glb files are not compressed (#3775).
  creator: { usefulMs: 10_000, bytes: 25 * MB, heap: 160 * MB, network: true },
  demo: { usefulMs: 10_000, bytes: 7 * MB, heap: 60 * MB, network: true },
  viewer: { usefulMs: 6_000, bytes: 6.5 * MB, heap: 40 * MB, network: false },
}

let browser: Browser
let server: ReturnType<typeof Bun.serve>
let base = ''

describe.skipIf(!BROWSER)('the phone budget (4x CPU)', () => {
  beforeAll(async () => {
    buildSite()
    server = serveSite()
    base = server.url.href.replace(/\/$/, '')
    browser = await launch()
  }, 180_000)

  afterAll(async () => {
    await Promise.race([
      browser?.close(),
      new Promise((r) => setTimeout(r, 20_000)),
    ])
    server?.stop(true)
  }, 30_000)

  test('every probe has a budget', () => {
    expect(Object.keys(BUDGET).sort()).toEqual(PROBES.map((p) => p.name).sort())
  })

  for (const probe of PROBES) {
    const budget = BUDGET[probe.name]!
    test.skipIf(budget.network && !NETWORK)(
      `${probe.name}: useful, bytes and heap under the ceiling`,
      async () => {
        const context = await phoneContext(browser)
        const page = await context.newPage()
        let cost: PageCost
        try {
          cost = await measure(page, base, probe, {
            network: false,
            timeoutMs: 240_000,
          })
        } finally {
          await context.close()
        }
        console.log(
          `${probe.name}: useful ${cost.usefulMs} ms, ready ${
            cost.readyMs
          } ms, ${(cost.transferBytes / MB).toFixed(2)} MB, heap ${(
            cost.peakHeapBytes / MB
          ).toFixed(1)} MB`
        )
        expect(cost.usefulMs).toBeLessThan(budget.usefulMs)
        expect(cost.transferBytes).toBeLessThan(budget.bytes)
        expect(cost.peakHeapBytes).toBeLessThan(budget.heap)
      },
      300_000
    )
  }
})
