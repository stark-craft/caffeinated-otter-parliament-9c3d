'use strict'
/*
  Safe three-action horizontal layout for latest Windows QuickShop sources.
  This edits presentation ONLY. All existing checkout labels, commands,
  handlers, cart quantity, and provider state remain untouched.

  From tv-frontend run:
  node .\apply-horizontal-cart-actions.cjs --check
  node .\apply-horizontal-cart-actions.cjs
*/
const fs = require('node:fs')
const path = require('node:path')
const CSS = "/* === QUICKBITE THREE-CHOICE ORDER ACTIONS: PRESENTATION ONLY ===\n   The backend still supplies every label and checkout/cancel action. */\n.qb-checkout-actions {\n  display: grid;\n  gap: 8px;\n  width: 100%;\n  align-items: stretch;\n}\n\n.qb-checkout-actions > .qb-primary-button,\n.qb-checkout-actions > .qb-secondary-button,\n.qb-answer-actions.qb-action-row-three > .qb-answer-action {\n  min-width: 0;\n  width: 100%;\n  min-height: 54px;\n  padding: 10px 5px;\n  font-size: clamp(12px, .85vw, 16px);\n  line-height: 1.2;\n  white-space: normal;\n  overflow-wrap: anywhere;\n  text-align: center;\n}\n\n.qb-answer-actions.qb-action-row-three {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  align-items: stretch;\n  gap: 8px;\n  max-width: none;\n}\n\n/* Agent-built carts already have a row; their 100%-width buttons\n   need flexible sizing to actually fit beside one another on TV. */\n.qb-cart-actions {\n  gap: 8px;\n}\n\n.qb-cart-actions > button {\n  flex: 1 1 0;\n  min-width: 0;\n  width: auto;\n  min-height: 54px;\n  padding: 10px 5px;\n  font-size: clamp(12px, .85vw, 16px);\n  line-height: 1.2;\n  white-space: normal;\n  overflow-wrap: anywhere;\n  text-align: center;\n}\n/* === END QUICKBITE THREE-CHOICE ORDER ACTIONS === */"
const START = '/* === QUICKBITE THREE-CHOICE ORDER ACTIONS: PRESENTATION ONLY ==='
const END = '/* === END QUICKBITE THREE-CHOICE ORDER ACTIONS === */'
const root = process.cwd()
const paths = {
  panel: path.join(root, 'src/components/quickbite/QuickBitePanel.jsx'),
  text: path.join(root, 'src/components/quickbite/screens/TextScreen.jsx'),
  css: path.join(root, 'src/styles/quickbite.css'),
}

function patchPanel(original) {
  if (original.includes('className="qb-checkout-actions"')) {
    if (!original.includes('checkoutActions.map(')) throw Error('Panel has a partial action-layout change')
    return original
  }
  const marker = /\{\s*!flowError\s*&&\s*checkoutActions\.map\s*\(/g
  const hits = [...original.matchAll(marker)]
  if (hits.length !== 1) throw Error('Panel: expected exactly one existing backend checkout action group; found ' + hits.length)
  const open = hits[0]
  const afterOpen = open.index + open[0].length
  // The existing mapping is directly followed by the next flowError guard
  // on both the newer Windows panel and the prior GitHub snapshot.
  const rest = original.slice(afterOpen)
  const tail = /(\},\s*\)\})\s*(?=\{\s*!flowError\s*&&)/
  const close = tail.exec(rest)
  if (!close) throw Error('Panel: checkout action group end changed; refusing an unsafe edit')
  const closeAt = afterOpen + close.index
  const opened = '{!flowError && checkoutActions.length > 0 && (\n' +
    '                <div className="qb-checkout-actions" style={{ gridTemplateColumns: ' +
    "'repeat(' + Math.min(checkoutActions.length, 3) + ', minmax(0, 1fr))'" +
    ' }}>\n                  {checkoutActions.map('
  const closed = close[1] + '\n                </div>\n              )}'
  const updated = original.slice(0, open.index) + opened +
    original.slice(afterOpen, closeAt) + closed +
    original.slice(closeAt + close[1].length)
  if (!updated.includes('qb-checkout-actions') || !updated.includes('checkoutActions.map('))
    throw Error('Panel: action mapping was not preserved')
  return updated
}

function patchText(original) {
  if (original.includes('qb-action-row-three')) return original
  const needle = 'className="qb-answer-actions"'
  if (original.split(needle).length !== 2) throw Error('TextScreen: response action container was not uniquely found')
  const row = "className={'qb-answer-actions' + (model.actions?.length === 3 && !model.retry && !model.reconnectProvider ? ' qb-action-row-three' : '')}"
  return original.replace(needle, row)
}

function patchCss(original) {
  if (original.includes(START)) {
    if (!original.includes(END)) throw Error('CSS contains an incomplete action-row style')
    return original
  }
  return original + (original.endsWith('\n') ? '\n' : '\n\n') + CSS + '\n'
}

function main() {
  for (const file of Object.values(paths)) {
    if (!fs.existsSync(file)) throw Error('Missing ' + path.relative(root, file) + '. Run from your tv-frontend folder.')
  }
  const entries = [
    [paths.panel, patchPanel],
    [paths.text, patchText],
    [paths.css, patchCss],
  ]
  // Validate ALL files before touching any of them.
  const updates = entries.map(([file, transform]) => {
    const original = fs.readFileSync(file, 'utf8')
    return {file, original, modified: transform(original)}
  })
  const changes = updates.filter(e => e.original !== e.modified)
  const names = changes.map(e => path.relative(root, e.file))
  if (process.argv.includes('--check')) {
    console.log('Validation successful. Planned updates: ' + (names.join(', ') || 'already applied'))
    return
  }
  if (!changes.length) {
    console.log('Already applied. No files changed.')
    return
  }
  const backupDir = path.join(root, '.order-action-layout-backup-' + Date.now())
  fs.mkdirSync(backupDir, {recursive:true})
  // Always back up all originals BEFORE applying the first write.
  for (const {file, original} of changes) {
    fs.writeFileSync(path.join(backupDir, path.basename(file)), original)
  }
  for (const {file, modified} of changes) {
    fs.writeFileSync(file, modified)
  }
  console.log('Horizontal layout applied. Original files backed up in: ' + backupDir)
  console.log('Next: npm test; npm run build')
}
try { main() } catch(error) { console.error('Not applied: ' + error.message); process.exitCode = 1 }
