// Run with the existing Vite server: node scripts/frontend-regression.cjs
// Backend calls and the transcript-delivery hook are mocked only in the browser.
// No production capture source changes, provider requests, real orders or payments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5174';
const LABELS = { zomato: 'Zomato', swiggy_food: 'Swiggy Food', swiggy_instamart: 'Swiggy Instamart', zepto: 'Zepto' };
const WORDS = { zomato: 'Order pav bhaji from Zomato', swiggy_food: 'Find dumplings from Swiggy Food', swiggy_instamart: 'Get kimchi ingredients from Swiggy Instamart', zepto: 'Get kimchi ingredients from Zepto' };
const evidence = [];
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
const panelSelector = 'aside[aria-label="QuickBite food ordering"][aria-hidden="false"]';

function result(id, basket = false) {
  if (basket) return { widget: 'basket_stocked', payload: { platform: LABELS[id], lines: [{ query: 'Cabbage', name: 'Cabbage', count: 1, line_total: 20 }], cut: [] } };
  const grocery = id === 'zepto' || id === 'swiggy_instamart';
  return { widget: 'carousel', payload: { kind: grocery ? 'grocery' : 'food', cards: [{ name: grocery ? 'Cabbage' : 'Test Kitchen', platform: LABELS[id], price: 20, rating: 4, in_stock: true }] }, vendor_widget: { server: id } };
}

async function fixture(browser, handler, initialState = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const state = { statuses: { zomato: true, swiggy: true, zepto: true }, sessionPlatforms: [
    { name: 'Zomato', connected: true }, { name: 'Swiggy', connected: true }, { name: 'Zepto', connected: true }],
    requests: [], events: [], errors: [], logging: [], pairingComplete: false, ...initialState };
  page.on('pageerror', error => state.errors.push(error.message));
  page.on('console', message => {
    if (!message.text().startsWith('[CommerceFlow]')) return;
    state.logging.push((async () => {
      const args = message.args();
      state.events.push({ stage: await args[0].jsonValue(), details: args[1] ? await args[1].jsonValue() : null });
    })());
  });
  await page.route('**/src/hooks/useSamsungVoice.js*', route => route.fulfill({ contentType: 'application/javascript',
    body: 'export function useSamsungVoice({onTranscript}) { window.__testTranscript = onTranscript; return {phase:"idle",micError:""}; }' }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path === '/api/session') body = { session_id: 'TEST-SESSION', platforms: state.sessionPlatforms };
    else if (path.startsWith('/api/qr/auth/status/')) body = typeof state.statuses[path.split('/').pop()] === 'boolean'
      ? { connected: state.statuses[path.split('/').pop()] } : {};
    else if (path === '/api/qr/session') body = { session_id: 'TEST-PAIRING' };
    else if (/\/api\/qr\/session\/[^/]+\/status$/.test(path)) body = { login_complete: state.pairingComplete };
    else if (path === '/api/chat') {
      const request = route.request().postDataJSON();
      state.requests.push({ ...request, session_id: '[redacted]' });
      body = await handler(request, state, path);
    } else if (path === '/api/track') body = await handler(route.request().postDataJSON(), state, path);
    else throw new Error(`Unexpected backend operation ${path}`);
    await route.fulfill({ status: body?.__fixtureStatus || 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__testTranscript === 'function');
  await page.getByRole('heading', { name: 'TV content unavailable', exact: true }).waitFor();
  await page.locator('[data-qb-focus="start-shopping"]').waitFor({ state: 'attached' });
  const speak = async text => page.evaluate(text => window.__testTranscript(text, 'en-IN', 'browser-regression'), text);
  const waitScreen = async screen => page.locator(`${panelSelector}[data-screen="${screen}"]`).waitFor();
  const click = key => page.locator(`${panelSelector} [data-qb-focus="${key}"]`).click();
  const finish = async () => { await Promise.all(state.logging); assert.deepEqual(state.errors, []); await context.close(); };
  return { context, page, state, speak, waitScreen, click, finish };
}

async function sequences(browser) {
  const cases = [
    ['zomato'], ['swiggy_food','zomato'], ['swiggy_instamart','zomato'], ['zepto','zomato'],
    ['swiggy_instamart','zepto','swiggy_food','zomato'], ['zomato','swiggy_instamart','zomato'],
    ['zomato','zepto','zomato'], ['swiggy_food','swiggy_instamart','swiggy_food'],
    ['swiggy_food','swiggy_food','swiggy_instamart','zepto','swiggy_instamart','swiggy_food','zomato'],
    ['swiggy_instamart','sushi'], ['zepto','zomato'],
    ['swiggy_food','swiggy_food','swiggy_instamart','swiggy_instamart_basket','zepto','zepto_ingredients','swiggy_food','zomato'],
  ];
  let cleanZomato;
  for (const sequence of cases) {
    let expected;
    let basket = false;
    const f = await fixture(browser, () => result(expected, basket));
    try {
      for (const id of sequence) {
        expected = id === 'sushi' ? 'swiggy_food' : id.replace(/_(?:basket|ingredients)$/, '');
        basket = id === 'zepto' || id.endsWith('_basket') || id.endsWith('_ingredients');
        const count = f.state.requests.length;
        await f.speak(id === 'sushi' ? 'Order sushi' : WORDS[expected]);
        assert.equal(f.state.requests.length, count + 1);
        const screen = basket ? 'gbasket' : ['zepto','swiggy_instamart'].includes(expected) ? 'gresults' : 'restaurant';
        await f.waitScreen(screen);
        const request = f.state.requests.at(-1);
        const vertical = ['zepto','swiggy_instamart'].includes(expected) ? 'grocery' : 'food';
        assert.equal(request.view.vertical, vertical);
        assert.deepEqual(request.view.items, []);
        assert.equal(request.view.cartCount, 0);
        assert.equal(request.view.screen, 'home');
        assert.equal(await f.page.locator(panelSelector).getAttribute('data-vertical'), vertical);
        if (id !== 'sushi') assert.ok(request.message.includes(`Use ${LABELS[expected]} only`));
        if (id === 'zomato') {
          assert.doesNotMatch(request.message, /Swiggy|Zepto|Instamart/);
          if (!cleanZomato) cleanZomato = request;
          assert.deepEqual(request, cleanZomato, 'fresh and long-history Zomato outbound requests must be identical');
        }
      }
      await Promise.all(f.state.logging);
      evidence.push({ scenario: sequence.join(' → '), requests: f.state.requests, diagnostics: f.state.events });
      console.log('PASS sequence:', sequence.join(' → '));
    } finally { await f.finish(); }
  }
}

async function mismatchAndAvailability(browser) {
  let response = result('swiggy_food');
  const f = await fixture(browser, () => response);
  try {
    await f.speak(WORDS.zomato);
    await f.page.getByRole('heading', { name: /Zomato was requested, but the backend returned Swiggy Food/ }).waitFor();
    assert.equal(await f.page.locator(`${panelSelector} [data-qb-focus="restaurant-0"]`).count(), 0);
    response = result('zomato');
    await f.click('retry');
    await f.waitScreen('restaurant');
    assert.equal(f.state.requests[0].message, f.state.requests[1].message);
    f.state.statuses.zomato = false;
    await f.click('exit');
    const statusRefresh = f.page.waitForResponse(response => new URL(response.url()).pathname === '/api/qr/auth/status/zomato');
    await f.page.keyboard.press('Enter');
    await statusRefresh;
    await f.page.waitForFunction(() => document.querySelector('aside[aria-label="QuickBite food ordering"]')?.getAttribute('aria-hidden') === 'false');
    await f.speak(WORDS.zomato);
    await f.waitScreen('restaurant');
    await Promise.all(f.state.logging);
    assert.ok(f.state.events.some(event => event.stage.endsWith('merchant-status') && event.details.observed.zomato === false));
    response = { widget: 'text', text: 'Zomato is not connected in this session — reconnect Zomato.' };
    await f.speak(WORDS.zomato);
    await f.page.getByRole('heading', { name: /Zomato is not connected in this session/ }).waitFor();
    await f.page.getByRole('button', { name: 'Reconnect Zomato', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Reconnect Zomato', exact: true }).waitFor();
    const count = f.state.requests.length;
    f.state.pairingComplete = true;
    await f.page.waitForTimeout(2300);
    await f.page.getByRole('heading', { name: 'Reconnect Zomato', exact: true }).waitFor();
    assert.equal(f.state.requests.length, count, 'reconnect must not replay chat or checkout');
    f.state.statuses.zomato = true;
    await f.page.waitForTimeout(2300);
    await f.waitScreen('text');
    response = result('zomato');
    await f.click('retry');
    await f.waitScreen('restaurant');
    await Promise.all(f.state.logging);
    assert.ok(f.state.events.some(event => event.stage.endsWith('provider-error')));
    assert.ok(f.state.events.some(event => event.stage.endsWith('merchant-status') && event.details.observed.zomato === false));
    console.log('PASS mismatch, original-provider retry, status changes and provider-specific reconnect.');
    evidence.push({ scenario: 'mismatch and merchant availability', requests: f.state.requests, diagnostics: f.state.events });
  } finally { await f.finish(); }
}

async function manualDiscovery(browser) {
  let mode = 'grocery';
  const f = await fixture(browser, request => {
    if (mode === 'grocery') return result('swiggy_instamart');
    assert.equal(request.view.vertical, 'food');
    assert.deepEqual(request.view.items, []);
    assert.match(request.message, /Zomato and Swiggy/);
    assert.doesNotMatch(request.message, /Instamart|Zepto/);
    return { widget: 'carousel', payload: { kind: 'food', cards: [{ name: 'Zomato Kitchen', platform: 'Zomato' }, { name: 'Swiggy Kitchen', platform: 'Swiggy' }] } };
  }, { sessionPlatforms: [{ name: 'Zomato', connected: false }, { name: 'Swiggy', connected: true }, { name: 'Zepto', connected: true }] });
  try {
    await f.speak(WORDS.swiggy_instamart);
    await f.waitScreen('gresults');
    await f.speak('open food');
    await f.waitScreen('category');
    mode = 'food';
    await f.click('category-0');
    await f.click('select-dish');
    await f.waitScreen('restaurant');
    await f.page.getByText('Zomato Kitchen', { exact: true }).waitFor();
    await f.page.getByText('Swiggy Kitchen', { exact: true }).waitFor();
    console.log('PASS manual Food discovery after grocery uses fresh status and displays both returned providers.');
  } finally { await f.finish(); }
}

async function responseRace(browser, failOlder = false) {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const f = await fixture(browser, async request => {
    if (request.message.startsWith(WORDS.swiggy_food)) { await hold; return failOlder ? { __fixtureStatus: 503, detail: 'Older Swiggy search failed' } : result('swiggy_food'); }
    return result('zomato');
  });
  try {
    const old = f.speak(WORDS.swiggy_food);
    await f.page.waitForFunction(() => document.querySelector('[data-screen="text"]'));
    await f.speak(WORDS.zomato);
    await f.waitScreen('restaurant');
    release();
    await old;
    await f.waitScreen('restaurant');
    await Promise.all(f.state.logging);
    assert.ok(f.state.events.some(event => event.stage.endsWith(failOlder ? 'superseded-error' : 'superseded-response')));
    const rendered = f.state.events.filter(event => event.stage.endsWith('rendered')).at(-1);
    assert.deepEqual(rendered.details.providers, ['zomato']);
    console.log(`PASS out-of-order search ${failOlder ? 'errors' : 'responses'} cannot replace the newer provider journey.`);
  } finally { release(); await f.finish(); }
}

async function continuations(browser) {
  const f = await fixture(browser, request => {
    if (/Add EXACTLY/.test(request.message)) {
      assert.match(request.message, /2× Bread/);
      assert.match(request.message, /Zepto/);
      return { widget: 'cart', payload: { platform: 'Zepto', items: [{ name: 'Bread', qty: 2, price: 20 }], total: 40 }, actions: ['Yes, place the order'] };
    }
    if (/menu\/show_menu/.test(request.message)) {
      assert.match(request.message, /Test Kitchen on Zomato/);
      return { widget: 'menu', payload: { restaurant: 'Test Kitchen', platform: 'Zomato', items: [{ name: 'Samosa', price: 12 }] } };
    }
    if (/Zomato/.test(request.message)) return result('zomato');
    return { widget: 'carousel', payload: { kind: 'grocery', cards: [{ name: 'Milk', platform: 'Zepto', price: 30 }, { name: 'Bread', platform: 'Zepto', price: 20 }] } };
  });
  try {
    await f.speak(WORDS.zepto); await f.waitScreen('gresults');
    await f.speak('show me the second one'); await f.waitScreen('greview');
    assert.equal(f.state.requests.length, 1, 'an ordinal selection stays local');
    await f.page.locator(`${panelSelector} .qb-grocery-name`).filter({ hasText: /^Bread$/ }).waitFor();
    await f.speak('add two more'); await f.waitScreen('cart');
    assert.equal(f.state.requests.length, 2);
    await f.speak(WORDS.zomato); await f.waitScreen('restaurant');
    assert.equal(f.state.requests.at(-1).view.cartCount, 0);
    assert.deepEqual(f.state.requests.at(-1).view.items, []);
    await f.speak('open that restaurant'); await f.waitScreen('menu');
    assert.equal(f.state.requests.at(-1).view.vertical, 'food');
    assert.equal(f.state.requests.at(-1).view.screen, 'restaurant');
    console.log('PASS ordinal selection, add two more, fresh provider search from cart and restaurant continuation.');
  } finally { await f.finish(); }
}

async function payment(browser, platform) {
  const zomato = platform === 'Zomato';
  const orderId = 'TEST-ORDER';
  let status = 'incomplete';
  let orders = 0;
  let polls = 0;
  const f = await fixture(browser, (request, state, path) => {
    if (path === '/api/track') {
      polls++;
      assert.equal(request.tracking.order_id, orderId);
      const pending = ['incomplete','qr','replacement'].includes(status);
      return { order_id: orderId, platform: zomato ? 'zomato' : platform,
        step: pending ? 'Placed' : status === 'preparing' ? 'In the kitchen' : status === 'travelling' ? 'On the way' : 'Delivered',
        order_status: pending ? "Your order's payment is incomplete" : status,
        done: status === 'delivered', tracking_url: 'https://zoma.to/t/EXAMPLE',
        ...(status === 'qr' ? { payment_qr: pixel } : {}), ...(status === 'replacement' ? { payment_qr: pixel + '#replacement' } : {}) };
    }
    if (request.message === 'Yes, place the order') {
      orders++;
      return zomato ? { widget: 'text', text: 'Your order is placed!', images: [], tracking: { server: 'zomato', kind: 'food', order_id: orderId, ctx: {} }, vendor_widget: null }
        : { widget: 'text', payload: { platform }, payment_method: 'COD', order_id: orderId, order_status: 'Placed', images: [] };
    }
    if (/Add EXACTLY/.test(request.message)) return { widget: 'cart', payload: { restaurant: 'Test Kitchen', platform, items: [{ name: 'Samosa', qty: 8, price: 96 }], total: 205.81, payment_method: { type: zomato ? 'upi_qr' : 'cod', label: zomato ? 'UPI QR' : 'COD' } }, actions: ['Yes, place the order','No, cancel'] };
    if (/menu\/show_menu/.test(request.message)) return { widget: 'menu', payload: { restaurant: 'Test Kitchen', platform, items: [{ name: 'Samosa', price: 12 }] } };
    return { widget: 'carousel', payload: { kind: 'food', cards: [{ name: 'Test Kitchen', platform, rating: 4 }] } };
  });
  try {
    await f.page.keyboard.press('Enter');
    await f.click('start-shopping');
    await f.click('mode-food');
    await f.click('category-0');
    await f.click('select-dish');
    await f.click('restaurant-0');
    await f.click('add-cart');
    await f.page.locator(`${panelSelector} [data-qb-focus="checkout-action-0"]`).waitFor();
    assert.equal(orders, 0);
    await f.page.locator(`${panelSelector} [data-qb-focus="checkout-action-0"]`).evaluate(button => { button.click(); button.click(); });
    if (!zomato) {
      await f.page.getByText('Cash on delivery', { exact: true }).waitFor();
    } else {
      await f.page.getByRole('alert').filter({ hasText: 'Zomato has not returned payment instructions yet' }).waitFor();
      assert.equal(await f.page.locator('.qb-pay .qb-spinner').count(), 0);
      assert.equal(await f.page.getByRole('img', { name: 'Payment QR code' }).count(), 0);
      await f.click('refresh-tracking');
      await f.page.getByRole('alert').filter({ hasText: 'Do not place the order again' }).waitFor();
      f.state.statuses = { zomato: false, swiggy: false, zepto: false };
      await f.click('exit'); await f.page.keyboard.press('Enter');
      await f.waitScreen('pay');
      await f.page.getByText('₹205.81', { exact: true }).waitFor();
      status = 'qr'; await f.click('refresh-tracking');
      await f.page.waitForFunction(image => document.querySelector('.qb-payment-qr')?.getAttribute('src') === image, pixel);
      status = 'replacement'; await f.click('refresh-tracking');
      await f.page.waitForFunction(image => document.querySelector('.qb-payment-qr')?.getAttribute('src') === image, pixel + '#replacement');
      status = 'preparing'; await f.click('refresh-tracking');
      await f.page.getByRole('heading', { name: 'Payment received', exact: true }).waitFor();
      await f.click('track-order'); status = 'incomplete'; await f.click('refresh-tracking');
      await f.page.getByRole('alert').filter({ hasText: 'Zomato has not returned payment instructions yet' }).waitFor();
      status = 'preparing'; await f.click('refresh-tracking');
      await f.page.getByRole('heading', { name: 'Payment received', exact: true }).waitFor();
      await f.click('track-order'); status = 'travelling'; await f.click('refresh-tracking');
      await f.waitScreen('on-the-way');
      status = 'delivered'; await f.click('refresh-tracking');
      await f.waitScreen('delivered');
      assert.ok(polls >= 8);
    }
    assert.equal(orders, 1, 'status checks and double clicks must not replay checkout');
    console.log(`PASS ${platform} checkout${zomato ? ', bounded missing instructions, later QR/replacement, auth loss, payment correction and delivery tracking' : ' existing COD flow'}; one submission.`);
  } finally { await f.finish(); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox','--disable-dev-shm-usage'], env: { ...process.env, XDG_CACHE_HOME: '/tmp/commagent-chromium-cache', XDG_CONFIG_HOME: '/tmp/commagent-chromium-config' } });
  try {
    await sequences(browser);
    await mismatchAndAvailability(browser);
    await manualDiscovery(browser);
    await responseRace(browser);
    await responseRace(browser, true);
    await continuations(browser);
    for (const platform of ['Zomato','Swiggy','Swiggy Instamart','Zepto']) await payment(browser, platform);
    fs.writeFileSync('/tmp/quickbite-provider-evidence.json', JSON.stringify(evidence, null, 2));
    console.log('PASS all browser regressions. Sanitized scenario traces: /tmp/quickbite-provider-evidence.json');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
