import test from 'node:test'
import assert from 'node:assert/strict'
import { HERO_SLIDES, groceryLandingRequest } from './catalog.js'
import { GROCERY_PRODUCTS } from '../quickbite/groceryCatalog.js'

test('demo hero contains one inert entertainment slide and the two fixed grocery promotions', () => {
  assert.deepEqual(HERO_SLIDES.map(slide => slide.id), ['himym', 'milk', 'cola'])
  assert.equal(groceryLandingRequest('himym'), null)
  assert.equal(groceryLandingRequest('checkout'), null)
})
test('shortcuts resolve the existing catalogue positions without discovery or mutation', () => {
  const before = JSON.stringify(GROCERY_PRODUCTS)
  for (const id of ['milk', 'chips']) {
    const request = groceryLandingRequest(id)
    assert.equal(request.type, 'voice-nav')
    assert.equal(request.target.type, 'grocery-product')
    assert.equal(GROCERY_PRODUCTS[request.target.categoryId][request.target.index].id, id)
    assert.equal('intent' in request, false)
    assert.equal('envelope' in request, false)
  }
  assert.equal(JSON.stringify(GROCERY_PRODUCTS), before)
})
