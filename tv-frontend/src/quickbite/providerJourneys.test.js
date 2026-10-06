import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveIntent } from './deriveIntent.js'
import { buildView, viewForRequest } from './viewContext.js'
import { searchPrompt } from './searchPrompt.js'
import { PROVIDERS, providerResponseProblem, requestedProviders, responseProviders } from './providers.js'
import { effectivePlatforms, mergeMerchantStatuses } from './merchantAccess.js'
import { routeIntent } from './intents.js'

const statements = {
  zomato: 'Order pav bhaji from Zomato',
  swiggy_food: 'Find dumplings from Swiggy Food',
  swiggy_instamart: 'Get kimchi ingredients from Swiggy Instamart',
  zepto: 'Get kimchi ingredients from Zepto',
}
const statuses = { zomato: true, swiggy: true, zepto: true }
const platforms = Object.keys(statuses).map(name => ({ name, connected: true }))
const sequences = [
  ['zomato'], ['swiggy_food', 'zomato'], ['swiggy_instamart', 'zomato'], ['zepto', 'zomato'],
  ['swiggy_instamart', 'zepto', 'swiggy_food', 'zomato'],
  ['zomato', 'swiggy_instamart', 'zomato'], ['zomato', 'zepto', 'zomato'],
  ['swiggy_food', 'swiggy_instamart', 'swiggy_food'],
  ['swiggy_food', 'swiggy_food', 'swiggy_instamart', 'zepto', 'swiggy_instamart', 'swiggy_food', 'zomato'],
]

for (const sequence of sequences) test(`provider journey: ${sequence.join(' → ')}`, () => {
  let state = { screen: 'home', vertical: 'food' }
  for (const id of sequence) {
    const view = buildView(state)
    const intent = deriveIntent(statements[id], view)
    assert.equal(intent.name, 'search')
    assert.equal(intent.journey, 'new-search')
    assert.equal(intent.slots.vertical, PROVIDERS[id].vertical)
    assert.deepEqual(intent.slots.providers, [id])
    const outboundView = viewForRequest(view, intent)
    const message = searchPrompt(statements[id], intent.slots.vertical, effectivePlatforms(statuses, platforms))
    assert.deepEqual(outboundView.items, [])
    assert.equal(outboundView.cartCount, 0)
    assert.equal(outboundView.vertical, PROVIDERS[id].vertical)
    assert.match(message, new RegExp(`Use ${PROVIDERS[id].label} only`))
    const cleanIntent = deriveIntent(statements[id], buildView({ screen: 'home', vertical: 'food' }))
    assert.deepEqual(outboundView, viewForRequest(buildView({ screen: 'home', vertical: 'food' }), cleanIntent))
    state = { screen: PROVIDERS[id].vertical === 'food' ? 'restaurant' : 'gresults', vertical: PROVIDERS[id].vertical,
      restaurants: [{ name: 'Old dish', platform: PROVIDERS[id].label }],
      groceryResults: [{ name: 'Old product', platform: PROVIDERS[id].label }],
      cart: { platform: PROVIDERS[id].label, items: [{ name: 'Old cart item' }] } }
  }
})

test('a new generic food request after Instamart is classified from its own utterance', () => {
  const view = buildView({ screen: 'gresults', vertical: 'grocery', groceryResults: [{ name: 'Cabbage', platform: 'Swiggy Instamart' }] })
  for (const utterance of ['Order sushi', 'Find restaurants that serve sushi', 'Find more sushi places']) {
    const intent = deriveIntent(utterance, view)
    assert.equal(intent.name, 'search')
    assert.equal(intent.slots.vertical, 'food')
    assert.deepEqual(intent.slots.providers, [])
    assert.doesNotMatch(searchPrompt(utterance, intent.slots.vertical, platforms), /Instamart|Zepto/)
  }
})

test('new named searches from a grocery cart cannot select an old item or inherit its provider', () => {
  const view = buildView({ screen: 'cart', vertical: 'grocery', cart: { items: [{ name: 'Pav Bhaji', platform: 'Zepto' }] } })
  const intent = deriveIntent('Order pav bhaji from Zomato', view)
  assert.equal(intent.name, 'search')
  assert.equal(intent.slots.item_ref, undefined)
  assert.equal(viewForRequest(view, intent).screen, 'home')
})

test('short explicit grocery-provider requests reach discovery instead of only opening the grocery grid', () => {
  for (const [utterance, provider] of [['Buy milk from Zepto', 'zepto'], ['Order bread from Instamart', 'swiggy_instamart']]) {
    const intent = deriveIntent(utterance, buildView({ screen: 'restaurant', vertical: 'food' }))
    assert.equal(intent.name, 'search')
    assert.equal(intent.slots.vertical, 'grocery')
    assert.deepEqual(intent.slots.providers, [provider])
  }
})

test('genuine reference, quantity, and refinement continuations retain visible context', () => {
  const view = buildView({ screen: 'gresults', vertical: 'grocery', focusKey: 'gresult-1',
    groceryResults: [{ name: 'Milk', platform: 'Zepto' }, { name: 'Bread', platform: 'Swiggy Instamart' }] })
  const second = deriveIntent('show me the second one', view)
  assert.equal(second.name, 'select')
  assert.equal(second.slots.item_ref.resolved_id, view.items[1].id)
  assert.equal(viewForRequest(view, second), view)
  const more = deriveIntent('add two more', view)
  assert.equal(more.name, 'add_to_cart')
  assert.equal(more.slots.item_ref.resolved_id, view.items[1].id)
  assert.equal(more.slots.quantity, 2)
  assert.equal(deriveIntent('open that restaurant', view).name, 'select')
  const cheaper = deriveIntent('find something cheaper', view)
  assert.equal(cheaper.slots.vertical, 'grocery')
  assert.equal(viewForRequest(view, cheaper), view)
})

test('explicit providers, comparisons and exclusions are kept distinct', () => {
  assert.deepEqual(requestedProviders('Order sushi from Swiggy'), ['swiggy_food'])
  assert.deepEqual(requestedProviders('Get ingredients from Swiggy'), ['swiggy_instamart'])
  assert.deepEqual(requestedProviders('Order sushi from Swiggy Food'), ['swiggy_food'])
  assert.deepEqual(requestedProviders('Find milk from Instamart'), ['swiggy_instamart'])
  assert.deepEqual(requestedProviders('Compare Zomato and Swiggy'), ['zomato', 'swiggy_food'])
  assert.deepEqual(requestedProviders('Use Swiggy instead of Zomato'), ['swiggy_food'])
  assert.deepEqual(requestedProviders('Do not use Zomato'), [])
  assert.deepEqual(requestedProviders('ZomatoPlus'), [])
})

test('merchant status and commerce-session availability are not conflated', () => {
  const staleSession = [{ name: 'Zomato', connected: false }, { name: 'Swiggy', connected: true }]
  const scope = effectivePlatforms(statuses, staleSession)
  assert.equal(scope.find(row => row.name === 'zomato').connected, true)
  assert.match(searchPrompt('Find samosa', 'food', scope), /Zomato and Swiggy/)
  assert.equal(effectivePlatforms({ zomato: false }, platforms)[0].connected, false)
  assert.deepEqual(mergeMerchantStatuses(statuses, { zomato: null, swiggy: true, zepto: false }), { zomato: true, swiggy: true, zepto: false })
  assert.equal(mergeMerchantStatuses(statuses, { zomato: false }).zomato, false)
  assert.doesNotMatch(searchPrompt('Order sushi', 'food', []), /are both connected|Only .* is connected/)
})

test('provider-attributed mismatches and session errors are visible; accepted data keeps its attribution', () => {
  const intent = deriveIntent(statements.zomato, buildView({ screen: 'home' }))
  const mismatch = { widget: 'carousel', payload: { kind: 'food', cards: [{ platform: 'Swiggy' }] }, vendor_widget: { server: 'swiggy_food' } }
  assert.equal(providerResponseProblem(intent, mismatch).kind, 'provider-mismatch')
  assert.deepEqual(responseProviders(mismatch), ['swiggy_food'])
  assert.deepEqual(responseProviders({ widget: 'carousel', payload: { data: { kind: 'grocery', products: [{ product: { platform: 'Swiggy' } }] } } }), ['swiggy_instamart'])
  const menu = { widget: 'menu', payload: { platform: 'Zomato' }, vendor_widget: { server: 'zomato' } }
  assert.equal(providerResponseProblem(intent, menu), null)
  assert.equal(providerResponseProblem(intent, { widget: 'text', text: 'Zomato is not connected in this session.' }).kind, 'provider-unavailable')
  assert.equal(providerResponseProblem(deriveIntent('Order sushi', {}), mismatch), null)
})

test('fresh search context does not bypass financial guards or discard existing order state', () => {
  const view = buildView({ screen: 'pay', vertical: 'grocery', cart: { items: [{ name: 'Milk' }] }, activeOrder: { seq: 2 } })
  const search = deriveIntent(statements.zomato, view)
  assert.ok(routeIntent(search, view).strip)
  assert.equal(viewForRequest(view, search).hasActiveOrder, true)
  assert.equal(deriveIntent('Place the order on Zomato', view).name, 'checkout')
  assert.equal(deriveIntent('Pay with UPI on Zomato', view).name, 'pay')
})
