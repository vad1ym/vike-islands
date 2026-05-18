/**
 * Performance benchmark for vike-islands examples.
 *
 * Usage:
 *   node benchmarks/bench.mjs [--warmup N] [--runs N] [--concurrency N] [--urls url1 label1 url2 label2 ...] [--pids port:pid ...]
 *
 * Defaults:
 *   --warmup 3   cold-start requests to discard
 *   --runs   50  measured runs per URL (min+max trimmed)
 *   --concurrency 50 concurrent requests per batch
 *   --urls       VUE http://localhost:3000/  ASTRO http://localhost:4321/
 *   --pids       optional PID overrides for localhost ports, e.g. 3000:12345 4321:23456
 *
 * Requires playwright to be available. Install once:
 *   npx playwright install chromium
 */

import { chromium } from 'playwright'
import { execFileSync } from 'child_process'

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const get = (flag, def) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : def
}

const WARMUP = parseInt(get('--warmup', '3'), 10)
const RUNS   = parseInt(get('--runs',   '50'), 10)
const CONCURRENCY = parseInt(get('--concurrency', '50'), 10)

// --urls label1 url1 label2 url2 ...
let URLS
const ui = args.indexOf('--urls')
if (ui !== -1) {
  const pairs = args.slice(ui + 1)
  URLS = []
  for (let i = 0; i < pairs.length; i += 2) URLS.push([pairs[i], pairs[i + 1]])
} else {
  URLS = [
    ['VUE   /', 'http://localhost:3000/'],
    ['ASTRO /', 'http://localhost:4321/'],
    // ['VUE   /ssr-only', 'http://localhost:3000/ssr-only'],
    // ['ASTRO /ssr-only', 'http://localhost:4321/ssr-only'],
  ]
}

const PID_OVERRIDES = new Map()
const pi = args.indexOf('--pids')
if (pi !== -1) {
  for (const entry of args.slice(pi + 1)) {
    if (entry.startsWith('--')) break
    const [port, pid] = entry.split(':')
    if (!port || !pid) continue
    PID_OVERRIDES.set(port, pid)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function trimmedMean(arr) {
  const sorted = [...arr].sort((a, b) => a - b).slice(1, -1)
  return Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1)
}

function parsePort(url) {
  try {
    const { hostname, port, protocol } = new URL(url)
    if (!['localhost', '127.0.0.1'].includes(hostname)) return null
    if (port) return port
    return protocol === 'https:' ? '443' : '80'
  } catch {
    return null
  }
}

function detectPidForPort(port) {
  const override = PID_OVERRIDES.get(port)
  if (override) return override
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim()
    return out.split('\n').find(Boolean) ?? null
  } catch {
    return null
  }
}

function readRssBytes(pid) {
  if (!pid) return null
  try {
    const rssKb = execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()
    const parsed = parseInt(rssKb, 10)
    return Number.isFinite(parsed) ? parsed * 1024 : null
  } catch {
    return null
  }
}

function parsePsTimeToMs(value) {
  const trimmed = value.trim()
  if (!trimmed) return null

  let days = 0
  let timePart = trimmed

  if (trimmed.includes('-')) {
    const [daysPart, rest] = trimmed.split('-', 2)
    days = parseInt(daysPart, 10)
    timePart = rest
    if (!Number.isFinite(days)) return null
  }

  const segments = timePart.split(':')
  if (segments.length < 2 || segments.length > 3) return null

  let hours = 0
  let minutes = 0
  let seconds = 0

  if (segments.length === 3) {
    hours = parseInt(segments[0], 10)
    minutes = parseInt(segments[1], 10)
    seconds = parseFloat(segments[2])
  } else {
    minutes = parseInt(segments[0], 10)
    seconds = parseFloat(segments[1])
  }

  if (![hours, minutes, seconds].every(Number.isFinite)) return null

  const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds
  return Math.round(totalSeconds * 1000)
}

function readCpuTimeMs(pid) {
  if (!pid) return null
  try {
    const cpuTime = execFileSync('ps', ['-o', 'time=', '-p', String(pid)], { encoding: 'utf8' }).trim()
    return parsePsTimeToMs(cpuTime)
  } catch {
    return null
  }
}

function ms(value) {
  return `${value} ms`
}

async function measureRequest(browser, url) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const bytes = { html: 0, js: 0, css: 0, total: 0, count: 0 }
  page.on('response', async res => {
    const type = res.request().resourceType()
    if (!['document', 'script', 'stylesheet'].includes(type)) return
    try {
      const buf = await res.body()
      const key = type === 'document' ? 'html' : type === 'script' ? 'js' : 'css'
      bytes[key] += buf.length
      bytes.total += buf.length
      bytes.count += 1
    } catch {}
  })

  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'networkidle' })
  const networkIdle = Date.now() - t0

  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const paint = Object.fromEntries(
      performance.getEntriesByType('paint').map(e => [e.name, Math.round(e.startTime)])
    )
    return {
      ttfb:             Math.round(nav.responseStart - nav.requestStart),
      domInteractive:   Math.round(nav.domInteractive - nav.startTime),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      load:             Math.round(nav.loadEventEnd - nav.startTime),
      fcp:              paint['first-contentful-paint'] ?? 0,
    }
  })

  await ctx.close()
  return { ...timing, networkIdle, ...bytes }
}

async function runBatch(browser, url, count) {
  return Promise.all(Array.from({ length: count }, () => measureRequest(browser, url)))
}

// ── Main ────────────────────────────────────────────────────────────────────
const browser = await chromium.launch()

for (const [label, url] of URLS) {
  const port = parsePort(url)
  const ssrPid = port ? detectPidForPort(port) : null

  // Warmup — discard results
  for (let i = 0; i < WARMUP; i += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, WARMUP - i)
    await runBatch(browser, url, batchSize)
  }

  const results = []
  const rssBatchBefore = readRssBytes(ssrPid)
  const cpuBatchBefore = readCpuTimeMs(ssrPid)

  for (let i = 0; i < RUNS; i += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, RUNS - i)
    results.push(...await runBatch(browser, url, batchSize))
  }
  const rssBatchAfter = readRssBytes(ssrPid)
  const rssBatchDelta = rssBatchBefore !== null && rssBatchAfter !== null
    ? rssBatchAfter - rssBatchBefore
    : null
  const cpuBatchAfter = readCpuTimeMs(ssrPid)
  const cpuBatchDelta = cpuBatchBefore !== null && cpuBatchAfter !== null
    ? cpuBatchAfter - cpuBatchBefore
    : null

  const t = k => trimmedMean(results.map(r => r[k]))
  const hasMemoryStats = Number.isFinite(rssBatchBefore) && Number.isFinite(rssBatchAfter)
  const hasCpuStats = Number.isFinite(cpuBatchBefore) && Number.isFinite(cpuBatchAfter)

  console.log(`\n════ ${label}  (warmup=${WARMUP}, runs=${RUNS}, concurrency=${CONCURRENCY}, trimmed mean) ════`)
  if (ssrPid) console.log(`  SSR PID:          ${ssrPid}`)
  console.log(`  Requests:         ${t('count')}`)
  console.log(`  HTML:             ${kb(t('html'))} KB`)
  console.log(`  JS:               ${kb(t('js'))} KB`)
  console.log(`  CSS:              ${kb(t('css'))} KB`)
  console.log(`  TOTAL:            ${kb(t('total'))} KB`)
  if (hasMemoryStats) {
    console.log(`  RSS before batch: ${kb(rssBatchBefore)} KB`)
    console.log(`  RSS after batch:  ${kb(rssBatchAfter)} KB`)
    console.log(`  RSS delta batch:  ${kb(rssBatchDelta)} KB`)
  }
  if (hasCpuStats) {
    console.log(`  CPU before batch: ${ms(cpuBatchBefore)}`)
    console.log(`  CPU after batch:  ${ms(cpuBatchAfter)}`)
    console.log(`  CPU delta batch:  ${ms(cpuBatchDelta)}`)
    console.log(`  CPU / request:    ${ms(Math.round(cpuBatchDelta / RUNS))}`)
  }
  console.log(`  ─────────────────────────────`)
  console.log(`  TTFB:             ${t('ttfb')} ms`)
  console.log(`  domInteractive:   ${t('domInteractive')} ms`)
  console.log(`  domContentLoaded: ${t('domContentLoaded')} ms`)
  console.log(`  Load:             ${t('load')} ms`)
  console.log(`  FCP:              ${t('fcp')} ms`)
  console.log(`  networkIdle:      ${t('networkIdle')} ms`)
}

await browser.close()
