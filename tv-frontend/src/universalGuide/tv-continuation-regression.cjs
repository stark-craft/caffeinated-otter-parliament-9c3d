// node src/universalGuide/tv-continuation-regression.cjs http://127.0.0.1:5183 /tmp/ug-playback-test.mp4
// All backend/auth/order responses and video are browser fixtures only.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const base = process.argv[2] || 'http://127.0.0.1:5183'
const video = process.argv[3]
const out = '/tmp/tv-layout-continuation'
fs.mkdirSync(out, { recursive: true })
const panel = 'aside.qb-panel[aria-hidden="false"]'
const milk = { name: 'Amul Taaza Toned Milk', brand: 'Amul', pack_size: '1 L', price: 74, platform: 'Zepto', in_stock: true }
const cola = { name: 'Coca-Cola Original Taste', pack_size: '1 L', price: 60, platform: 'Swiggy Instamart', in_stock: true }
const result = cards => ({ widget: 'carousel', payload: { kind: 'grocery', cards } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function fixture(browser, handler, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1920, height: 1080 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const state = { grocery: true, food: true, complete: false, chats: [], qrCreates: 0, errors: [], ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('https://**/*', route => route.abort())
  if (video && fs.existsSync(video)) await page.route('**/video/tv-content.mp4', route => route.fulfill({ path: video, contentType: 'video/mp4' }))
  await page.route('**/src/hooks/useSamsungVoice.js*', route => route.fulfill({ contentType: 'application/javascript',
    body: 'export function useSamsungVoice({onTranscript}) { window.__testTranscript=onTranscript; return {phase:"idle",micError:""}; }' }))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body
    if (path === '/api/session') body = { session_id: 'FIXTURE-SESSION', platforms: state.grocery ? ['Swiggy', 'Zepto'] : state.food ? ['Zomato'] : [] }
    else if (path.startsWith('/api/qr/auth/status/')) body = { connected: path.endsWith('/zomato') ? state.food
      : path.endsWith('/swiggy') ? state.swiggy ?? state.grocery : state.grocery }
    else if (path === '/api/qr/session') { state.qrCreates++; body = { session_id: 'FIXTURE-PAIRING' } }
    else if (/\/api\/qr\/session\/[^/]+\/status$/.test(path)) body = { login_complete: state.complete }
    else if (path === '/api/chat') { const request = route.request().postDataJSON(); state.chats.push(request); body = await handler(request, state) }
    else throw new Error(`Unexpected fixture endpoint: ${path}`)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(options.classic ? `${base}/?home=classic` : base, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => typeof window.__testTranscript === 'function')
  await page.waitForFunction(() => localStorage.getItem('ca_sid') === 'FIXTURE-SESSION' &&
    (document.querySelector('.qb-qr-placeholder')?.textContent === 'QR unavailable' ||
      !document.querySelector('.qb-qr-panel')))
  const click = key => page.locator(`${panel} [data-qb-focus="${key}"]`).click()
  const hero = async id => { await page.getByRole('button', { name: `Show ${id}`, exact: true }).click(); await page.locator(`.hero-banner[data-product-id="${id}"]`).click() }
  const review = async name => {
    await page.locator(`${panel}[data-screen="greview"] .qb-quantity-row`).waitFor()
    assert.equal(await page.locator(`${panel} .qb-grocery-name`).textContent(), name)
    assert.equal(await page.locator(`${panel} .qb-quantity-controls strong`).textContent(), '1')
    assert.equal(await page.locator(`${panel} .qb-restaurant-list`).count(), 0)
    assert.equal(await page.locator(`${panel} .qb-select-dish`).count(), 0)
  }
  const finish = async () => { assert.deepEqual(state.errors, []); await context.close() }
  return { page, state, click, hero, review, finish }
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const el = document.querySelector(selector)
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, scrollLeft: el.scrollLeft }
    }
    return { frame: rect('.ug-home-frame'), overlay: rect('.ug-commerce-host > .vp-commerce-overlay'),
      panel: rect('aside.qb-panel[aria-hidden="false"]'), video: rect('video') }
  })
}
function sameRect(a, b, message) {
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[key] - b[key]) < 1, `${message}: ${key}: ${a[key]} != ${b[key]}`)
}
const foodResults = { widget: 'carousel', payload: { kind: 'food', cards: [{ kind: 'restaurant', name: 'Fixture Pizza', platform: 'Zomato', rest_id: 'fixture-place' }] } }
const say = (page, text) => page.evaluate(text => window.__testTranscript(text, 'en-IN', 'samsung-fixture'), text)
async function paired(f, connects = { food: true, grocery: true }) {
  Object.assign(f.state, connects, { complete: true })
  await f.page.locator('aside.qb-qr-panel[aria-hidden="false"]').waitFor({ state: 'hidden' })
}

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
      let f = await fixture(browser, async () => result([milk]), { viewport })
      await f.hero('milk')
      await f.review(milk.name)
      const home = await geometry(f.page)
      await f.finish()
      f = await fixture(browser, async () => result([milk]), { viewport })
      await f.page.locator('.ug-video-launch').click()
      await f.page.keyboard.press('Enter')
      await f.page.locator(`${panel} .qb-home-cta`).waitFor()
      const video = await geometry(f.page)
      sameRect(home.frame, video.frame, 'home/video use the same squeeze')
      sameRect(home.panel, video.panel, 'home/video use the same panel dimensions')
      sameRect(video.panel, video.overlay, 'initial panel occupies its full host')
      sameRect(video.video, video.frame, 'video is not squeezed a second time')
      assert.equal(video.overlay.scrollLeft, 0)
      await f.page.screenshot({ path: `${out}/squeezed-video-${viewport.width}.png` })
      for (let i = 0; i < 3; i++) {
        await f.page.keyboard.press('Enter')
        await f.page.locator(`${panel} .qb-mode-grid`).waitFor()
        await f.page.keyboard.press('Backspace')
        await f.page.locator(`${panel} .qb-home-cta`).waitFor()
        const roundTrip = await geometry(f.page)
        sameRect(roundTrip.panel, roundTrip.overlay, 'focus round trip does not clip the panel')
        assert.equal(roundTrip.overlay.scrollLeft, 0)
      }
      // Exercise the scroll-reset fallback for engines without overflow:clip.
      await f.page.addStyleTag({ content: '.ug-commerce-host > .vp-commerce-overlay { overflow: hidden !important; }' })
      await f.page.locator(`${panel} .qb-home-cta`).evaluate(el => el.scrollIntoView())
      await f.page.waitForFunction(() => document.querySelector('.ug-commerce-host > .vp-commerce-overlay').scrollLeft === 0)
      await f.click('exit')
      for (let i = 0; i < 6; i++) await f.page.keyboard.press('Backspace')
      assert.equal(await f.page.locator('.ug-video-view').count(), 1, 'repeated Back stays in video')
      await f.page.evaluate(() => { window.__originalVideo = document.querySelector('video'); window.__pausedBefore = window.__originalVideo.paused; document.activeElement.blur() })
      // Samsung keycode fallback with lost DOM focus; repeat must do nothing.
      await f.page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 10252, repeat: true, bubbles: true, cancelable: true })))
      assert.equal(await f.page.locator('.ug-video-view').count(), 1)
      await f.page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 10252, bubbles: true, cancelable: true })))
      await f.page.locator('.ug-player:not(.ug-video-view)').waitFor()
      assert.equal(await f.page.evaluate(() => window.__originalVideo === document.querySelector('video') && window.__pausedBefore === window.__originalVideo.paused), true)
      await f.page.locator('.ug-video-launch').click()
      await f.page.keyboard.press('Enter')
      await f.page.locator(`${panel} .qb-home-cta`).waitFor()
      await f.page.keyboard.press('Space')
      await f.page.locator('.ug-player:not(.ug-video-view):not(.ug-shop-open)').waitFor()
      await f.page.screenshot({ path: `${out}/home-${viewport.width}.png` })
      await f.finish()
      console.log(`PASS ${viewport.width}: same geometry, full panel on first Enter, scroll fallback, repeated Back, Samsung Play/Pause and Space`)
    }
    {
      const f = await fixture(browser, async () => result([{ ...milk, name: 'Fixture Orange Juice' }]), { food: false, grocery: false })
      await say(f.page, 'I want to buy some juice')
      await f.page.locator('.qb-qr-code').waitFor()
      assert.equal(f.state.chats.length, 0)
      // Connecting the wrong vertical must not consume the request.
      Object.assign(f.state, { complete: true, food: true })
      await f.page.waitForTimeout(2400)
      assert.equal(f.state.chats.length, 0)
      await paired(f, { grocery: true })
      await f.page.locator(`${panel} .qb-grocery-name`).waitFor()
      assert.equal(f.state.chats.length, 1)
      assert.match(f.state.chats[0].message, /I want to buy some juice/u)
      assert.equal(f.state.chats[0].view.vertical, 'grocery')
      assert.equal(await f.page.locator(`${panel} .qb-home-cta`).count(), 0)
      await f.page.waitForTimeout(2200)
      assert.equal(f.state.chats.length, 1, 'pairing continuation runs once')
      await f.finish()
      console.log('PASS voice juice retains its utterance, waits for Grocery and resumes once into results')
    }
    {
      const f = await fixture(browser, async () => foodResults, { food: false, grocery: true, swiggy: false })
      await say(f.page, 'order pizza')
      await f.page.locator('.qb-qr-code').waitFor()
      assert.equal(f.state.chats.length, 0)
      await paired(f)
      await f.page.getByText('Fixture Pizza', { exact: true }).waitFor()
      assert.equal(f.state.chats.length, 1)
      assert.match(f.state.chats[0].message, /order pizza/u)
      await f.finish()
      console.log('PASS Food voice request survives login with Grocery already connected')
    }
    {
      const f = await fixture(browser, async () => foodResults, { food: false, grocery: false })
      await f.hero('milk')
      await f.page.locator('.qb-qr-code').waitFor()
      await say(f.page, 'order pizza')
      await paired(f, { food: true, grocery: false })
      await f.page.getByText('Fixture Pizza', { exact: true }).waitFor()
      assert.equal(f.state.chats.length, 1)
      assert.match(f.state.chats[0].message, /order pizza/u)
      assert.doesNotMatch(f.state.chats[0].message, /Amul/u)
      await f.finish()
      console.log('PASS latest voice request replaces the pending milk banner')
    }
    {
      const f = await fixture(browser, async () => foodResults, { food: false, grocery: false })
      await say(f.page, 'order pizza')
      await f.page.locator('.qb-qr-code').waitFor()
      await f.page.keyboard.press('Backspace')
      await f.page.locator('.ug-player:not(.ug-shop-open)').waitFor()
      Object.assign(f.state, { food: true, grocery: true, complete: true })
      await f.page.locator('.ug-video-launch').click()
      await f.page.keyboard.press('Enter')
      await f.page.locator(`${panel} .qb-home-cta`).waitFor()
      assert.equal(f.state.chats.length, 0, 'cancelled utterance never resumes')
      await f.finish()
      console.log('PASS cancelling login drops the pending voice; plain Enter has no invented context')
    }
    {
      const f = await fixture(browser, async () => result([milk]), { food: false, grocery: false })
      await say(f.page, 'order pizza')
      await f.page.locator('.qb-qr-code').waitFor()
      await say(f.page, 'I want to purchase some milk')
      await paired(f, { food: false, grocery: true })
      await f.page.locator(`${panel} .qb-grocery-name`).waitFor()
      assert.equal(f.state.chats.length, 1)
      assert.match(f.state.chats[0].message, /I want to purchase some milk/u)
      assert.doesNotMatch(f.state.chats[0].message, /pizza/u)
      await f.finish()
      console.log('PASS latest utterance replaces the pending Food request and changes its required login')
    }
    {
      const f = await fixture(browser, async () => { throw new Error('Local voice navigation must not search') }, { food: false, grocery: false })
      await say(f.page, 'buy milk')
      await f.page.locator('.qb-qr-code').waitFor()
      await paired(f)
      await f.page.locator(`${panel} .qb-dish-stage[aria-label="Product carousel"]`).waitFor()
      assert.equal(await f.page.locator(`${panel} .qb-dish-card.is-selected .qb-dish-name`).textContent(), 'Milk')
      assert.equal(f.state.chats.length, 0)
      await f.finish()
      console.log('PASS existing local voice navigation resumes at Milk after pairing without Start Shopping or a backend search')
    }
    for (const id of ['milk', 'cola']) {
      const offer = id === 'milk' ? milk : cola
      const f = await fixture(browser, async () => result([offer]), { food: false, grocery: false })
      await f.hero(id)
      await f.page.locator('.qb-qr-code').waitFor()
      await f.page.evaluate(() => {
        window.__homeFrames = 0
        window.__recordHome = true
        const record = () => {
          if (!window.__recordHome) return
          const home = document.querySelector('aside.qb-panel[aria-hidden="false"] .qb-home-cta')
          if (home && getComputedStyle(home).visibility === 'visible') window.__homeFrames++
          requestAnimationFrame(record)
        }
        requestAnimationFrame(record)
      })
      await paired(f)
      await f.review(offer.name)
      assert.equal(f.state.chats.length, 1)
      assert.equal(await f.page.evaluate(() => { window.__recordHome = false; return window.__homeFrames }), 0, 'pairing must not flash Start Shopping')
      await f.page.keyboard.press('Enter')
      assert.equal(await f.page.locator(`${panel} .qb-quantity-controls strong`).textContent(), '2', 'remote OK reaches the quantity control after pairing')
      assert.equal(f.state.chats.length, 1, 'quantity selection remains local')
      await f.finish()
      console.log(`PASS ${id}: pairing resumes directly into quantity review without a Start Shopping frame`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
