import { QUICKBITE_CATEGORIES, QUICKBITE_DISHES } from './catalog.js'
import { GROCERY_CATEGORIES, GROCERY_PRODUCTS } from './groceryCatalog.js'

export function normalizeVoicePhrase(value) {
  return String(value || '').normalize('NFKC').replace(/[’‘]/g, "'")
    .toLowerCase().replace(/&/g, ' and ').replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const commands = []
function add(command, aliases) {
  commands.push({ command, aliases })
}

add({ type: 'home' }, [
  'home', 'quickbite', 'quick bite', 'quickshop', 'quick shop', 'shop', 'shopping',
  'start shopping', 'start shop', 'open shopping', 'open shop', 'open quickbite',
  'open quick bite', 'open quickshop', 'open quick shop', 'i want to shop',
  'i want to shop something', 'i want to do some shopping', 'let me shop',
  "let's shop", 'lets shop', 'take me shopping', 'go shopping',
  'start quickbite', 'start quick bite', 'start quickshop', 'start quick shop',
])
add({ type: 'food' }, [
  'food', 'order food', 'get food', 'buy food', 'show food', 'show me food',
  'open food', 'food ordering', 'i want food', 'i need food', 'hungry',
  'i am hungry', "i'm hungry", 'im hungry', 'something to eat',
  'show me something to eat', 'suggest food', 'suggest me food',
  'suggest something to eat', 'suggest me something to eat',
  'what should i eat', 'i want something to eat', 'i need something to eat',
])
add({ type: 'grocery' }, [
  'grocery', 'groceries', 'order grocery', 'order groceries', 'buy grocery',
  'buy groceries', 'get grocery', 'get groceries', 'show grocery',
  'show groceries', 'show me groceries', 'open grocery', 'open groceries',
  'grocery shopping', 'start grocery shopping', 'i want groceries',
  'i need groceries',
])
add({ type: 'track' }, [
  'track order', 'track my order', 'track the order', 'order tracking',
  'order status', 'my order status', 'show order status', 'show my order status',
  'where is my order', "where's my order", 'check order', 'check my order',
  'check order status', 'check my order status', 'track delivery',
])

const foodCategories = {
  snacks: ['snack', 'snacks', 'order snacks', 'get snacks', 'buy snacks', 'show snacks', 'show me snacks', 'i want snacks', 'i want a snack', 'quick snack', 'something to snack on'],
  desserts: ['dessert', 'desserts', 'sweet', 'sweets', 'order dessert', 'order desserts', 'get dessert', 'show desserts', 'something sweet', 'i want something sweet', 'i want dessert'],
  beverages: ['beverage', 'beverages', 'drink', 'drinks', 'order drink', 'order drinks', 'get drink', 'show drinks', 'something to drink', 'i want to drink something', 'i want a drink', 'thirsty', 'i am thirsty', "i'm thirsty", 'im thirsty'],
  fullmeal: ['meal', 'full meal', 'order meal', 'order full meal', 'get meal', 'proper meal', 'lunch', 'dinner', 'order lunch', 'order dinner', 'i want lunch', 'i want dinner'],
}
const groceryCategories = {
  'fruits-veg': ['fruits', 'fruit', 'vegetables', 'vegetable', 'fruits and vegetables', 'fruit and vegetables', 'fresh produce', 'produce', 'grocery fruits', 'grocery vegetables', 'buy vegetables', 'buy fruits', 'order fruits', 'order vegetables', 'order fruits and vegetables'],
  'dairy-bakery': ['dairy', 'bakery', 'dairy and bakery', 'grocery dairy', 'dairy products', 'show dairy', 'show bakery'],
  'snacks-packaged': ['grocery snacks', 'packaged snacks', 'packaged food', 'grocery packaged snacks', 'show packaged snacks'],
  'beverages-grocery': ['grocery beverages', 'grocery beverage', 'grocery drinks', 'packaged drinks', 'show grocery drinks'],
}
for (const category of QUICKBITE_CATEGORIES) {
  add({ type: 'food-category', id: category.id, name: category.name }, foodCategories[category.id] || [])
}
for (const category of GROCERY_CATEGORIES) {
  add({ type: 'grocery-category', id: category.id, name: category.name }, groceryCategories[category.id] || [])
}

const foodProducts = {
  samosa: ['samosas'], 'chole-bhature': ['chole bhatura', 'chhole bhature'],
  'pao-bhaji': ['pav bhaji', 'pav bhaaji'], biryani: ['biriyani'],
  'gulab-jamun': ['gulab jamuns'], 'kaju-katli': ['kaju barfi'],
  rasgulla: ['rasgullas', 'rosogolla'], 'masala-chai': ['chai', 'tea', 'hot tea'],
  lassi: [], thandai: [], 'veg-thali': ['vegetarian thali', 'thali'],
  'rajma-chawal': ['rajma rice'], 'dal-makhani': ['daal makhani'],
}
const groceryProducts = {
  bananas: ['banana'], tomatoes: ['tomato'], onions: ['onion'],
  potatoes: ['potato'], milk: ['packet of milk', 'milk packet'],
  bread: ['bread loaf', 'loaf of bread'], eggs: ['egg'], paneer: [],
  chips: ['potato chips'], biscuits: ['biscuit', 'cookies'],
  namkeen: ['namkin'], cola: ['cold drink', 'soft drink'],
  'orange-juice': ['juice'], 'green-tea': [],
}
function productAliases(product, variants) {
  const names = [product.name, ...variants]
  return [...new Set(names.flatMap((name) => [
    name, `order ${name}`, `buy ${name}`, `get ${name}`,
    `i want ${name}`, `show ${name}`, `find ${name}`,
  ]))]
}
for (const [categoryId, dishes] of Object.entries(QUICKBITE_DISHES)) {
  dishes.forEach((dish, index) => add(
    { type: 'food-product', id: dish.id, categoryId, index, name: dish.name },
    productAliases(dish, foodProducts[dish.id] || []),
  ))
}
for (const [categoryId, products] of Object.entries(GROCERY_PRODUCTS)) {
  products.forEach((product, index) => add(
    { type: 'grocery-product', id: product.id, categoryId, index, name: product.name },
    productAliases(product, groceryProducts[product.id] || []),
  ))
}

export const VOICE_COMMANDS = commands
const lookup = new Map()
for (const entry of commands) {
  for (const alias of entry.aliases) {
    const key = normalizeVoicePhrase(alias)
    if (key && !lookup.has(key)) lookup.set(key, entry.command)
  }
}
export function findVoiceCommand(transcript) {
  return lookup.get(normalizeVoicePhrase(transcript)) || null
}

// Samsung's title-selection path can compare visible labels case-sensitively.
// Keep explicit case forms, while JavaScript transcript lookup above is case-insensitive.
const samsungTargets = []
const seenLabels = new Set()
for (const entry of commands) {
  const take = (pattern, count) => entry.aliases.filter((alias) => pattern.test(alias)).slice(0, count)
  const coreAliases = [...new Set([
    ...take(/^(?!order |open |start |show |buy |get |i |let |take |go |suggest |check |track |where |what )/i, 2),
    ...take(/^order /i, 2), ...take(/^open /i, 1), ...take(/^start /i, 1),
    ...take(/^show /i, 1), ...take(/^buy /i, 1),
  ])]
  for (const alias of coreAliases) {
    const title = alias.replace(/\b\w/g, (letter) => letter.toUpperCase())
    const words = alias.split(' ')
    const mixed = words.length <= 4
      ? Array.from({ length: 2 ** words.length }, (_, mask) => words.map(
        (word, index) => mask & (1 << index)
          ? word.replace(/^\w/, (letter) => letter.toUpperCase()) : word,
      ).join(' '))
      : []
    for (const label of [alias, title, alias.toUpperCase(), ...mixed]) {
      if (seenLabels.has(label)) continue
      seenLabels.add(label)
      samsungTargets.push({ label, command: entry.command })
    }
  }
}
export function getHiddenVoiceTargets() { return samsungTargets }
