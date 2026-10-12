// node src/universalGuide/direct-grocery-regression.cjs http://127.0.0.1:5183 /tmp/ug-playback-test.mp4
// All backend/auth/order responses and video are browser fixtures only.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const base = process.argv[2] || 'http://127.0.0.1:5183'
const video = process.argv[3]
const out = '/tmp/hero-direct-grocery'
fs.mkdirSync(out, { recursive: true })
const panel = 'aside.qb-panel[aria-hidden="false"]'
const milk = { name: 'Amul Taaza Toned Milk', brand: 'Amul', pack_size: '1 L', price: 74, platform: 'Zepto', in_stock: true }
const cola = { name: 'Coca-Cola Original Taste', pack_size: '1 L', price: 60, platform: 'Swiggy Instamart', in_stock: true }
const result = cards => ({ widget: 'carousel', payload: { kind: 'grocery', cards } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function fixture(browser, handler, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' })
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
    else if (path.startsWith('/api/qr/auth/status/')) body = { connected: path.endsWith('/zomato') ? state.food : state.grocery }
    else if (path === '/api/qr/session') { state.qrCreates++; body = { session_id: 'FIXTURE-PAIRING' } }
    else if (/\/api\/qr\/session\/[^/]+\/status$/.test(path)) body = { login_complete: state.complete }
    else if (path === '/api/chat') { const request = route.request().postDataJSON(); state.chats.push(request); body = await handler(request, state) }
    else throw new Error(`Unexpected fixture endpoint: ${path}`)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(options.classic ? `${base}/?home=classic` : base, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => typeof window.__testTranscript === 'function')
  await page.waitForFunction(() => localStorage.getItem('ca_sid') === 'FIXTURE-SESSION' &&
    document.querySelector('.qb-qr-placeholder')?.textContent === 'QR unavailable')
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

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    {
      const gate = deferred()
      const f = await fixture(browser, async (request, state) => {
        if (request.message === 'Yes, place the order') return { widget: 'text', payload: { platform: 'Swiggy Instamart' }, payment_method: 'COD', order_id: 'FIXTURE-ORDER', order_status: 'Placed' }
        if (/Add EXACTLY/u.test(request.message)) return { widget: 'cart', payload: { kind: 'grocery', platform: 'Swiggy Instamart', items: [{ name: milk.name, qty: 2, unit_price: 80 }], total: 160, payment_method: 'COD' }, actions: ['Yes, place the order'] }
        await gate.promise
        return result([{ ...milk, brand: 'Other', name: 'Other Milk' }, { ...milk, pack_size: '500 ml' },
          { ...milk, in_stock: false }, { ...milk, platform: '' }, { ...milk, platform: 'Swiggy Instamart', price: 80 }, { ...milk, price: 60, best: true }])
      })
      await f.page.getByRole('button', { name: 'How I Met Your Mother', exact: true }).click()
      assert.equal(f.state.chats.length, 0)
      await f.page.evaluate(() => { window.__originalVideo = document.querySelector('video') })
      await f.hero('milk')
      await f.page.getByText('Finding Amul Milk 1 L', { exact: true }).waitFor()
      assert.equal(f.state.chats.length, 1)
      assert.equal(await f.page.locator(`${panel} [data-qb-focus="add-gcart"]`).count(), 0)
      gate.resolve()
      await f.review(milk.name)
      assert.equal(await f.page.locator(`${panel} [data-qb-focus="gqty-plus"]:focus`).count(), 1)
      await f.page.getByText('₹80', { exact: true }).waitFor()
      assert.equal(await f.page.evaluate(() => window.__originalVideo === document.querySelector('video')), true)
      await f.page.screenshot({ path: `${out}/milk-quantity.png` })
      await f.click('gqty-plus')
      assert.equal(f.state.chats.length, 1, 'quantity changes are local')
      await f.click('add-gcart')
      await f.page.locator(`${panel} [data-qb-focus="checkout-action-0"]`).waitFor()
      assert.equal(f.state.chats.length, 2, 'only explicit Add mutates the cart')
      assert.match(f.state.chats[1].message, /Order from Swiggy Instamart/u)
      assert.match(f.state.chats[1].message, /2× Amul Taaza Toned Milk \(1 L\)/u)
      await f.click('checkout-action-0')
      await f.page.getByText('Cash on delivery', { exact: true }).waitFor()
      assert.equal(f.state.chats.length, 3)
      assert.equal(f.state.chats[2].message, 'Yes, place the order')
      await f.click('exit')
      await f.hero('milk')
      await f.page.getByText('Payment in progress. Cancel the order?', { exact: true }).waitFor()
      assert.equal(f.state.chats.length, 3, 'payment guard must block banner discovery')
      await f.finish()
      console.log('PASS exact milk offer, persistent video, local quantity, explicit provider cart and checkout')
    }
    {
      const f = await fixture(browser, async () => result([{ ...cola, name: 'Coca-Cola Zero Sugar' }, { ...cola, pack_size: '2 L' }, cola]))
      await f.hero('cola'); await f.review(cola.name)
      assert.equal(f.state.chats.length, 1)
      assert.match(f.state.chats[0].message, /Find Coca-Cola 1 L/u)
      await f.page.screenshot({ path: `${out}/cola-quantity.png` })
      await f.finish()
      console.log('PASS Coca-Cola 1 L skips brand/provider selection and rejects zero/2 L substitutions')
    }
    for (const { food, id, card } of [{ food: false, id: 'milk', card: milk }, { food: true, id: 'cola', card: cola }]) {
      const f = await fixture(browser, async () => result([card]), { grocery: false, food })
      await f.hero(id)
      await f.page.locator('aside.qb-qr-panel[aria-hidden="false"] .qb-qr-code svg').waitFor()
      assert.equal(f.state.chats.length, 0, 'QR pairing must precede discovery')
      assert.equal(f.state.qrCreates, 1)
      f.state.grocery = true; f.state.complete = true
      await f.review(card.name)
      assert.equal(f.state.chats.length, 1, 'remembered banner must search only once after login')
      await f.finish()
      console.log(`PASS QR-first automatic search after pairing (${food ? 'Food only' : 'no merchants'})`)
    }
    {
      const f = await fixture(browser, async () => result([milk]), { grocery: false, food: false })
      await f.hero('milk')
      await f.page.locator('aside.qb-qr-panel[aria-hidden="false"] .qb-qr-code svg').waitFor()
      await f.page.keyboard.press('Backspace')
      f.state.grocery = true; f.state.complete = true
      await f.page.getByRole('button', { name: 'Now Playing — open video view' }).click()
      await f.page.keyboard.press('Enter')
      await f.page.locator(`${panel}[data-screen="home"]`).waitFor()
      assert.equal(f.state.chats.length, 0, 'cancelled QR target must not search after later pairing')
      await f.finish()
      console.log('PASS cancelling QR drops the banner target and does not search after a later login')
    }
    {
      const f = await fixture(browser, async (_, state) => state.chats.length === 1
        ? result([{ ...milk, pack_size: '500 ml' }, { ...milk, in_stock: false }]) : result([milk]))
      await f.hero('milk')
      await f.page.getByRole('alert').filter({ hasText: 'No in-stock Amul Milk 1 L' }).waitFor()
      assert.equal(await f.page.locator(`${panel} .qb-quantity-row`).count(), 0)
      assert.equal(await f.page.locator(`${panel} .qb-restaurant-list`).count(), 0)
      await f.click('retry'); await f.review(milk.name)
      assert.equal(f.state.chats.length, 2)
      await f.finish()
      console.log('PASS unavailable exact product has retry, no substitution/picker and no cart mutation')
    }
    {
      const gate = deferred()
      const f = await fixture(browser, async request => {
        if (/Amul/u.test(request.message)) { await gate.promise; return result([milk]) }
        return result([cola])
      })
      await f.hero('milk'); await f.page.getByText('Finding Amul Milk 1 L', { exact: true }).waitFor()
      await f.page.keyboard.press('Backspace')
      await f.page.locator('.ug-home:not([inert])').waitFor()
      await f.hero('cola'); await f.review(cola.name)
      gate.resolve(); await f.page.waitForTimeout(350)
      assert.equal(await f.page.locator(`${panel} .qb-grocery-name`).textContent(), cola.name)
      assert.equal(f.state.chats.length, 2)
      await f.finish()
      console.log('PASS closed/superseded milk result cannot overwrite the new Coca-Cola review')
    }
    {
      const gate = deferred()
      const f = await fixture(browser, async () => { await gate.promise; return result([milk]) })
      await f.hero('milk'); await f.page.getByText('Finding Amul Milk 1 L', { exact: true }).waitFor()
      await f.page.keyboard.press('Backspace')
      gate.resolve(); await f.page.waitForTimeout(350)
      assert.equal(await f.page.locator('aside.qb-panel[aria-hidden="false"]').count(), 0)
      assert.equal(await f.page.locator('aside.qb-panel .qb-quantity-row').count(), 0)
      assert.equal(f.state.chats.length, 1)
      await f.finish()
      console.log('PASS late search response stays discarded after closing the panel')
    }
    {
      const f = await fixture(browser, async () => result([milk]))
      await f.page.evaluate(() => window.__testTranscript('Milk', 'en-IN', 'regression'))
      await f.page.locator(`${panel}[data-screen="gproduct"]`).waitFor()
      assert.equal(f.state.chats.length, 0)
      await f.click('select-gproduct')
      await f.page.locator(`${panel}[data-screen="gresults"] [data-qb-focus="gresult-0"]`).waitFor()
      assert.equal(f.state.chats.length, 1)
      await f.click('gresult-0'); await f.review(milk.name)
      await f.finish()
      console.log('PASS ordinary grocery navigation retains its existing search/result selection flow')
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
