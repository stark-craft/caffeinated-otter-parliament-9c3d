// Additional mocked TV audit, invoked by frontend-regression.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');

module.exports = async function finalAudit(browser, { fixture, visibleFocus, panelSelector, auditDir }) {
  const focus = (f, key) => f.page.locator(`${panelSelector} [data-qb-focus="${key}"]`).focus();
  const arrow = async (f, key, label, shot) => { await f.page.keyboard.press(key); return visibleFocus(f, label, shot); };
  const cart = (platform, label = 'No, cancel') => ({ widget: 'cart', text: 'Review the actual cart.',
    payload: { kind: platform === 'Zomato' ? 'food' : 'grocery', platform, total: 82,
      items: [{ name: 'Audit item', qty: 2, price: 41 }] }, actions: ['Yes, place the order', label] });

  // Full Food/Grocery browsing, normal review controls, loading and checkout.
  for (const grocery of [false, true]) {
    const platform = grocery ? 'Zepto' : 'Zomato';
    let release;
    const hold = new Promise(resolve => { release = resolve; });
    const f = await fixture(browser, async request => {
      if (request.message.includes('Add EXACTLY')) { await hold; return cart(platform); }
      if (request.message.includes('menu/show_menu')) return { widget: 'menu', payload: { platform, restaurant: 'Audit Kitchen',
        items: [{ name: 'Audit dish', price: 41, variants: [{ label: 'Small', price: 41 }, { label: 'Large', price: 82 }] }] } };
      return { widget: 'carousel', payload: { kind: grocery ? 'grocery' : 'food', cards: [
        { name: grocery ? 'Milk' : 'Audit Kitchen', platform, price: 41, in_stock: true },
        { name: grocery ? 'Bread' : 'Next Kitchen', platform, price: 42, in_stock: true }] } };
    });
    try {
      await f.page.keyboard.press('Enter'); await f.waitScreen('home'); await visibleFocus(f, `${platform} Home`);
      await f.click('start-shopping'); await f.waitScreen('mode');
      await visibleFocus(f, 'Mode Food', grocery ? undefined : '01-mode-food');
      await arrow(f, 'ArrowRight', 'Mode Grocery', grocery ? undefined : '02-mode-grocery');
      await f.click(grocery ? 'mode-grocery' : 'mode-food');
      await visibleFocus(f, `${platform} first category`, grocery ? undefined : '03-category-first');
      await arrow(f, 'ArrowRight', `${platform} second category`, grocery ? undefined : '04-category-second');
      await arrow(f, 'ArrowDown', `${platform} category Down`);
      await arrow(f, 'ArrowUp', `${platform} category Up`);
      await arrow(f, 'ArrowLeft', `${platform} category Left`);
      await f.click(grocery ? 'gcategory-0' : 'category-0');
      await visibleFocus(f, `${platform} carousel selection`);
      await arrow(f, 'ArrowRight', `${platform} carousel next selected`);
      await arrow(f, 'ArrowDown', `${platform} carousel select CTA`);
      await f.click(grocery ? 'select-gproduct' : 'select-dish');
      await f.waitScreen(grocery ? 'gresults' : 'restaurant');
      await visibleFocus(f, `${platform} first result`, grocery ? undefined : '05-restaurant-first');
      await arrow(f, 'ArrowDown', `${platform} second result`, grocery ? undefined : '06-restaurant-second');
      await arrow(f, 'ArrowUp', `${platform} previous result`);
      await f.page.keyboard.press('Escape');
      await visibleFocus(f, `${platform} Back to carousel`);
      await f.click(grocery ? 'select-gproduct' : 'select-dish');
      await f.waitScreen(grocery ? 'gresults' : 'restaurant');
      await f.click(grocery ? 'gresult-0' : 'restaurant-0');
      await f.waitScreen(grocery ? 'greview' : 'review');
      await visibleFocus(f, `${platform} Review entry / selected variant`);
      await focus(f, grocery ? 'gqty-plus' : 'qty-plus');
      await visibleFocus(f, `${platform} Review quantity`, grocery ? undefined : '07-review-quantity');
      await arrow(f, 'ArrowDown', `${platform} Review Add to Cart`, grocery ? undefined : '08-review-add');
      await arrow(f, 'ArrowDown', `${platform} Review Shop More`, grocery ? undefined : '09-review-shop-more');
      const before = f.state.requests.length;
      await f.page.keyboard.press('Enter'); await f.waitScreen('mode');
      assert.equal(await f.page.locator(panelSelector).getAttribute('data-focus-key'), grocery ? 'mode-grocery' : 'mode-food');
      assert.equal(f.state.requests.length, before, 'Shop More is navigation only');
      await f.page.keyboard.press('Escape'); await f.waitScreen(grocery ? 'greview' : 'review');
      await visibleFocus(f, `${platform} Review restored after Shop More/Back`);
      await f.click(grocery ? 'add-gcart' : 'add-cart'); await f.waitScreen('cart');
      await f.page.getByText('Preparing your cart', { exact: true }).waitFor();
      await visibleFocus(f, `${platform} immediate cart loading`);
      release(); await f.page.locator(`${panelSelector} [data-qb-focus="checkout-action-0"]`).waitFor();
      assert.equal(await f.page.locator(panelSelector).getAttribute('data-focus-key'), 'checkout-action-0', 'stationary mouse cannot steal the new cart focus');
      await visibleFocus(f, `${platform} first checkout action`, grocery ? undefined : '10-cart-first-action');
      await arrow(f, 'ArrowDown', `${platform} second checkout action`, grocery ? undefined : '11-cart-next-action');
      await arrow(f, 'ArrowDown', `${platform} Cart Shop More`);
      assert.equal(await f.page.locator(panelSelector).getAttribute('data-focus-key'), 'shop-more');
      const cartRequests = f.state.requests.length;
      await f.page.keyboard.press('Enter'); await f.waitScreen('mode');
      assert.equal(await f.page.locator(panelSelector).getAttribute('data-focus-key'), grocery ? 'mode-grocery' : 'mode-food');
      await visibleFocus(f, `${platform} valid cart Shop More`);
      await f.page.keyboard.press('Escape'); await f.waitScreen('cart');
      await f.page.getByText('Audit item', { exact: true }).waitFor();
      assert.equal(f.state.requests.length, cartRequests, 'Shop More/Back preserves a valid cart without requests');
      await visibleFocus(f, `${platform} valid cart restored`);
      await focus(f, 'back'); await visibleFocus(f, `${platform} Back button`);
      await arrow(f, 'ArrowRight', `${platform} Exit button`);
      await arrow(f, 'ArrowLeft', `${platform} Back again`);
      console.log(`PASS audit ${platform} focus matrix, immediate Add-to-Cart and valid-cart Shop More/Back.`);
    } finally { release(); await f.finish(); }
  }

  // Agent widgets, selected-vs-focus, comparison Best, editor and modal layers.
  {
    const widgets = JSON.parse(fs.readFileSync(`${__dirname}/../src/quickbite/fixtures/widget_envelopes.json`));
    let response = widgets.comparison;
    const f = await fixture(browser, () => response);
    try {
      await f.speak('Compare milk from Zepto and Instamart'); await f.waitScreen('compare');
      await visibleFocus(f, 'Compare first provider', '12-comparison-first');
      await arrow(f, 'ArrowDown', 'Compare second provider / Best un-focused', '13-comparison-second');
      await arrow(f, 'ArrowUp', 'Compare first provider again');
      response = { widget: 'basket_stocked', payload: { platform: 'Zepto', total: 40, lines: [
        { name: 'Cabbage', count: 2, price: 10 }, { name: 'Rice', count: 2, price: 10 }] } };
      await f.speak('Find ingredients from Zepto'); await f.waitScreen('agent-cart');
      await visibleFocus(f, 'Editor row one', '14-editor-row-first');
      await arrow(f, 'ArrowLeft', 'Editor row one minus');
      await arrow(f, 'ArrowRight', 'Editor row one plus');
      await arrow(f, 'ArrowDown', 'Editor row two plus', '15-editor-row-second');
      await arrow(f, 'ArrowDown', 'Editor bottom action');
      await arrow(f, 'ArrowUp', 'Editor last row plus restored');
      response = widgets.basket;
      await f.speak('Compare breakfast baskets from Zepto and Instamart'); await f.waitScreen('basket-compare');
      await visibleFocus(f, 'Basket comparison first');
      await arrow(f, 'ArrowDown', 'Basket comparison second / Best');
      await arrow(f, 'ArrowUp', 'Basket comparison previous');
      response = widgets.spend_report;
      await f.speak('Show my spending report'); await f.waitScreen('spend');
      await visibleFocus(f, 'Spend report action');
      await arrow(f, 'ArrowDown', 'Spend Back');
      await arrow(f, 'ArrowRight', 'Spend Exit');
      response = { widget: 'menu', payload: { platform: 'Zomato', restaurant: 'Audit Kitchen', items: [
        { name: 'Dish One', price: 20 }, { name: 'Dish Two', price: 30 }] } };
      await f.speak('Show the menu from Zomato'); await f.waitScreen('menu');
      await visibleFocus(f, 'Menu first item');
      await arrow(f, 'ArrowDown', 'Menu second item');
      await f.page.keyboard.press('Enter'); await f.waitScreen('review');
      await visibleFocus(f, 'Menu to Review');
      await f.page.keyboard.press('Escape'); await f.waitScreen('menu');
      await visibleFocus(f, 'Menu Back restoration');
      response = { widget: 'new_unknown_widget' };
      await f.speak('Find something from Zomato'); await f.waitScreen('text');
      await visibleFocus(f, 'Retry/error screen');
      response = { widget: 'text', text: 'Choose a cart action.', actions: ['Clear cart'] };
      await f.speak('Find ingredients from Zepto'); await f.waitScreen('text');
      await visibleFocus(f, 'Text destructive action');
      await f.click('text-action-0');
      await visibleFocus(f, 'Confirmation first / underlying inert', '16-confirmation-first');
      await arrow(f, 'ArrowRight', 'Confirmation second / underlying inert', '17-confirmation-second');
      await f.page.keyboard.press('Tab'); await visibleFocus(f, 'Confirmation Tab trapped');
      await f.page.keyboard.press('Escape');
      const restored = await visibleFocus(f, 'Underlying focus restored after confirmation Back');
      assert.equal(restored.focusKey, 'text-action-0');
      console.log('PASS audit agent widgets, comparison/editor hierarchy, menu, retry and confirmation focus restoration.');
    } finally { await f.finish(); }
  }

  // Supported Food/Grocery destructive actions: Keep/Back, once-only Confirm,
  // backend success, clean result, mode focus, no cleared-cart Back resurrection.
  for (const [platform, label] of [['Zomato', 'No, cancel'], ['Swiggy Instamart', 'Cancel cart'], ['Zepto', 'Clear cart']]) {
    let clears = 0;
    const message = `${platform} cart has been cleared.`;
    const f = await fixture(browser, request => {
      if (request.message === label) { clears++; return { widget: 'text', text: message }; }
      return cart(platform, label);
    });
    try {
      await f.speak(`Find items from ${platform}`); await f.waitScreen('agent-cart');
      await f.click('acart-checkout'); await f.waitScreen('cart');
      await f.click('checkout-action-1'); await visibleFocus(f, `${platform} clear confirmation`);
      await f.page.keyboard.press('Escape');
      await f.page.getByText('Audit item', { exact: true }).waitFor(); assert.equal(clears, 0);
      await f.click('checkout-action-1'); await f.page.getByRole('button', { name: 'Keep cart', exact: true }).click();
      await f.page.getByText('Audit item', { exact: true }).waitFor(); assert.equal(clears, 0);
      await f.click('checkout-action-1');
      await f.page.getByRole('button', { name: 'Confirm', exact: true }).evaluate(button => { button.click(); button.click(); });
      await f.waitScreen('cart-cleared');
      await f.page.getByText(message, { exact: true }).waitFor();
      assert.equal(clears, 1);
      assert.equal(f.state.requests.at(-1).message, label);
      assert.equal(await f.page.locator(`${panelSelector} .qb-cart-item, ${panelSelector} .qb-cart-line, ${panelSelector} [data-qb-focus^="checkout-action-"]`).count(), 0);
      await visibleFocus(f, `${platform} cleared cart`, platform === 'Zomato' ? '18-cancelled-cart' : undefined);
      await f.click('shop-more'); await f.waitScreen('mode');
      assert.equal(await f.page.locator(panelSelector).getAttribute('data-focus-key'), platform === 'Zomato' ? 'mode-food' : 'mode-grocery');
      await f.page.keyboard.press('Escape'); await f.waitScreen('home');
      await f.click('start-shopping'); await f.waitScreen('mode');
      assert.equal(await f.page.getByText('Audit item', { exact: true }).count(), 0);
      assert.equal(clears, 1);
      console.log(`PASS audit ${platform} explicit ${label}: Keep/Back preserve cart, Confirm once clears state and history.`);
    } finally { await f.finish(); }
  }

  for (const outcome of ['decline', 'failure', 'order-evidence']) {
    let clears = 0;
    const f = await fixture(browser, (request, state, path) => {
      if (path === '/api/track') return { order_id: 'UNEXPECTED-ORDER', step: 'Preparing', done: false };
      if (request.message === 'No, cancel') { clears++; return outcome === 'failure'
        ? { __fixtureStatus: 503, detail: 'Cart service unavailable' }
        : outcome === 'order-evidence' ? { widget: 'text', text: 'The backend returned an existing order.', payment_method: 'COD',
            tracking: { server: 'zomato', kind: 'food', order_id: 'UNEXPECTED-ORDER' } }
        : { widget: 'text', text: 'Checkout declined. Your cart remains available.' }; }
      return cart('Zomato');
    });
    try {
      await f.speak('Find food from Zomato'); await f.waitScreen('agent-cart');
      await f.click('acart-checkout'); await f.waitScreen('cart');
      await f.click('checkout-action-1'); await f.page.getByRole('button', { name: 'Confirm', exact: true }).click();
      if (outcome === 'order-evidence') {
        await f.waitScreen('payment-received');
        assert.equal(await f.page.locator('[data-screen="cart-cleared"]').count(), 0);
        assert.equal(f.state.requests.filter(request => request.message === 'Yes, place the order').length, 0);
        await visibleFocus(f, 'Unexpected order evidence after destructive label remains authoritative');
      } else if (outcome === 'failure') {
        await f.page.getByText('Cart cancellation was not confirmed. Review the provider cart before trying again.', { exact: true }).waitFor();
        await f.page.getByText('Audit item', { exact: true }).waitFor();
        await f.click('retry'); await f.waitScreen('cart');
        await f.page.locator(`${panelSelector} [data-qb-focus="checkout-action-0"]`).waitFor();
      } else {
        await f.waitScreen('text'); await f.page.keyboard.press('Escape'); await f.waitScreen('cart');
        await f.page.getByText('Audit item', { exact: true }).waitFor();
      }
      if (outcome !== 'order-evidence') await visibleFocus(f, `Cart ${outcome} preserves current bill`);
      assert.equal(clears, 1, 'uncertain/declined cart request is never automatically replayed');
      console.log(outcome === 'order-evidence'
        ? 'PASS audit unexpected order/payment evidence remains authoritative; no synthetic clear or checkout replay.'
        : `PASS audit cart ${outcome} preserves cart; readonly recovery never replays destructive action.`);
    } finally { await f.finish(); }
  }

  // Known active COD order vanishes, while a fresh waiting session must remain
  // non-terminal. Advance the actual poll timers to prove cancellation stops.
  for (const fresh of [false, true]) {
    let disappeared = fresh, orders = 0;
    const orderId = '250237112920408';
    const f = await fixture(browser, (request, state, path) => {
      if (path === '/api/track') return disappeared ? { waiting: true, step: null, order_id: null, done: false }
        : { order_id: orderId, step: 'Preparing', done: false };
      if (request.message === 'Yes, place the order') {
        if (!fresh) orders++; return { widget: 'text', text: fresh ? 'No active order yet.' : 'Order placed.', payment_method: 'COD',
          tracking: { server: 'swiggy_instamart', kind: 'grocery', order_id: fresh ? null : orderId } };
      }
      return cart('Swiggy Instamart');
    });
    try {
      await f.page.clock.install();
      await f.speak('Find ingredients from Instamart');
      await f.waitScreen('agent-cart'); await f.click('acart-checkout'); await f.waitScreen('cart');
      await f.click('checkout-action-0');
      if (fresh) {
        await f.page.waitForFunction(() => document.querySelector('[data-screen="pay"]'));
        await visibleFocus(f, 'Fresh empty order is not cancelled');
        assert.equal(await f.page.locator('[data-screen="cancelled"]').count(), 0);
        assert.equal(orders, 0);
      } else {
        await f.waitScreen('payment-received');
        await visibleFocus(f, 'COD payment received'); await f.click('track-order'); await f.waitScreen('preparing');
        await visibleFocus(f, 'COD Preparing');
        disappeared = true; await f.click('refresh-tracking'); await f.waitScreen('cancelled');
        await visibleFocus(f, 'COD disappeared placed order Cancelled', '19-cod-order-cancelled');
        const polls = f.state.trackRequests.length;
        await f.page.clock.fastForward(65000); await f.page.waitForTimeout(100);
        assert.equal(f.state.trackRequests.length, polls, 'terminal cancellation must stop automatic polling');
        await f.waitScreen('cancelled'); assert.equal(orders, 1);
      }
      console.log(`PASS audit ${fresh ? 'fresh empty tracking never cancels' : 'Instamart COD disappearance cancels and stops polling'}.`);
    } finally { await f.finish(); }
  }
};
