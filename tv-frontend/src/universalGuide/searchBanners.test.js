import assert from 'node:assert/strict'
import test from 'node:test'
import { searchBannerPlan } from './searchBanners.js'

test('only shopping promo slides search; entertainment and unrelated slides remain inert', () => {
  assert.equal(searchBannerPlan('himym', () => true), null)
  assert.equal(searchBannerPlan('milk', () => true), null)
  assert.equal(searchBannerPlan('nonsense', () => true), null)
})

test('match-night searches Zomato first, falls back to Swiggy, never both', () => {
  const both = searchBannerPlan('match-night', () => true)
  assert.equal(both.provider, 'zomato')
  assert.equal(both.login, false)
  assert.match(both.prompt, /Zomato only/)
  const fallback = searchBannerPlan('match-night', id => id === 'swiggy')
  assert.equal(fallback.provider, 'swiggy_food')
  assert.match(fallback.prompt, /Swiggy Food only/)
  assert.doesNotMatch(fallback.prompt, /Zomato/)
})

test('match-night without either food provider requests Food pairing', () => {
  const plan = searchBannerPlan('match-night', () => false)
  assert.equal(plan.login, true)
  assert.equal(plan.vertical, 'food')
  assert.equal(plan.provider, null)
})

test('grocery promo uses exactly one Zepto search for five products, no checkout', () => {
  const plan = searchBannerPlan('grocery-basket', merchant => merchant === 'zepto')
  assert.equal(plan.login, false)
  assert.equal(plan.vertical, 'grocery')
  assert.equal(plan.provider, 'zepto')
  for (const product of ['potato chips','popcorn','Coca-Cola','salted peanuts','biscuits'])
    assert.ok(plan.prompt.includes(product), product)
  assert.match(plan.prompt, /one multi-product search/i)
  assert.match(plan.prompt, /Do not add/)
  assert.equal(searchBannerPlan('grocery-basket', () => false).login, true)
})
