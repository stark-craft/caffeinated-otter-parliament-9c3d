'use strict'
// Apply live-order tracking to the newest Windows source without replacing
// checkout, search, voice or any unrelated local implementation.
// Usage: node apply-order-tracking.cjs --check
//        node apply-order-tracking.cjs
const fs = require('node:fs')
const path = require('node:path')
const D = "export function trackingDisplay(snapshot, phase = trackingPhase(snapshot)) {\n  const direct = typeof snapshot?.step === 'string' ? snapshot.step.trim() : ''\n  const indexed = !direct && Array.isArray(snapshot?.steps) &&\n    Number.isInteger(snapshot?.current) && snapshot.current >= 0 &&\n    snapshot.current < snapshot.steps.length\n      ? String(snapshot.steps[snapshot.current] || '').trim() : ''\n  const providerStep = direct || indexed\n  const status = providerStep || trackingText(snapshot)\n  // The rider reaching the restaurant is not yet the delivery departing.\n  const displayPhase = phase === 'on-the-way' && /^at (?:the )?restaurant$/i.test(providerStep)\n    ? 'preparing' : phase\n  const completedThrough = displayPhase === 'delivered' ? 2\n    : displayPhase === 'on-the-way' ? 1 : -1\n  const title = displayPhase === 'delivered' ? 'Delivered'\n    : status || (displayPhase === 'on-the-way' ? 'On the way' : 'Preparing your order')\n  const icon = displayPhase === 'delivered' ? '🎉'\n    : /\\b(?:at your door|at the door|doorstep|reached your location)\\b/i.test(providerStep) ? '🚪'\n    : /^at (?:the )?restaurant$/i.test(providerStep) ? '🏪'\n    : displayPhase === 'on-the-way' ? '🛵' : '👨‍🍳'\n  return { phase: displayPhase, status, title, icon, completedThrough }\n}\n\n"
const F = "export function trackingFooter(snapshot, descriptor) {\n  if (!descriptor || !snapshot) return null\n  // A response explicitly reporting no order is not a trackable item.\n  if (snapshot.found === false && !snapshot.order_id) return null\n  const display = trackingDisplay(snapshot)\n  const status = display.status || (snapshot.waiting ? 'Checking order status' : 'Order status')\n  const terminal = ['delivered', 'cancelled'].includes(display.phase)\n  const eta = !terminal && typeof snapshot.eta === 'string' ? snapshot.eta.trim() : ''\n  return { status, eta, phase: display.phase, screen: screenForTracking(snapshot) }\n}\n\n"
const S = "function TrackingStepper({ phase, completedThrough }) {\n  const current = phase === 'delivered' ? 2 : phase === 'on-the-way' ? 1 : 0\n  const lastCompleted = Number.isInteger(completedThrough) ? completedThrough\n    : phase === 'delivered' ? 2 : phase === 'on-the-way' ? 1 : -1\n  return (\n    <div className=\"qb-tracking-steps\" aria-label={`Order stage: ${phase}`}>\n      {['Preparing', 'On the way', 'Delivered'].map((label, index) => (\n        <div className=\"qb-track-fragment\" key={label}>\n          {index > 0 && (\n            <span className={`qb-track-line ${index <= lastCompleted ? 'is-done' : ''}`} />\n          )}\n          <div className={`qb-track-step ${index <= lastCompleted ? 'is-done' : ''} ${index === current ? 'is-current' : ''}`}>\n            <span className=\"qb-track-circle\">{index <= lastCompleted ? '✓' : index + 1}</span>\n            <span>{label}</span>\n          </div>\n        </div>\n      ))}\n    </div>\n  )\n}\n"
const R = "    function renderTrackingScreen(\n      phase,\n    ) {\n      const display = trackingDisplay(trackingSnapshot, phase)\n      const isDelivered = phase === 'delivered'\n      const title = display.title\n      return (\n        <>\n          <TrackingStepper phase={display.phase} completedThrough={display.completedThrough} />\n          <div\n            className={`qb-tracking-content ${\n              isDelivered\n                ? 'is-delivered'\n                : ''\n            }`}\n          >\n            <div className=\"qb-track-hero-icon\" aria-hidden=\"true\">\n              {display.icon}\n            </div>\n            <h1>{title}</h1>\n            {isDelivered && (\n              <>\n                <h2>\n                  At your doorstep\n                </h2>\n                <p className=\"qb-enjoy\">\n                  Enjoy food!\n                </p>\n              </>\n            )}\n            {!isDelivered &&\n              trackingSnapshot?.eta && (\n                <p className=\"qb-track-eta\">\n                  Arriving in{' '}\n                  {\n                    trackingSnapshot.eta\n                  }\n                </p>\n              )}\n            <div className=\"qb-order-status-card\">\n              <PlatformBadge platform={orderPlatformName} />\n              {(\n                trackingSnapshot?.restaurant_name ||\n                selectedRestaurant?.name ||\n                cart?.restaurant\n              ) && (\n                <h3>\n                  {\n                    trackingSnapshot?.restaurant_name ||\n                    selectedRestaurant?.name ||\n                    cart?.restaurant\n                  }\n                </h3>\n              )}\n              {display.status && (\n                <p>\n                  {display.status}\n                </p>\n              )}\n              {trackingSnapshot?.message &&\n                trackingSnapshot.message !==\n                display.status && (\n                  <small>\n                    {\n                      trackingSnapshot.message\n                    }\n                  </small>\n                )}\n              {trackingSnapshot?.order_id && (\n                <span>\n                  Order{' '}\n                  {\n                    trackingSnapshot.order_id\n                  }\n                </span>\n              )}\n              {trackingSnapshot?.rider\n                ?.name && (\n                  <div className=\"qb-rider-row\">\n                    <span>\n                      🛵\n                    </span>\n                    <strong>\n                      {\n                        trackingSnapshot\n                          .rider.name\n                      }\n                    </strong>\n                    {trackingSnapshot\n                      .rider.rating !=\n                      null && (\n                        <em>\n                          ★{' '}\n                          {\n                            trackingSnapshot\n                              .rider.rating\n                          }\n                        </em>\n                      )}\n                  </div>\n                )}\n            </div>\n            {trackingState?.stale && (\n              <p className=\"qb-stale-warning\">\n                {\n                  trackingState.error\n                }\n              </p>\n            )}\n            {!isDelivered && (\n              <button\n                className={`qb-secondary-button ${\n                  focusKey ===\n                    'refresh-tracking'\n                    ? 'is-focused'\n                    : ''\n                }`}\n                {...focusableProps(\n                  'refresh-tracking',\n                )}\n              >\n                {trackingState?.polling\n                  ? 'Refreshing…'\n                  : 'Refresh'}\n              </button>\n            )}\n            <button\n              className={`qb-text-button ${\n                focusKey ===\n                  'shop-more'\n                  ? 'is-focused'\n                  : ''\n              }`}\n              {...focusableProps(\n                'shop-more',\n              )}\n            >\n              Shop More\n            </button>\n          </div>\n        </>\n      )\n    }\n"
const C = "/* Quiet, persistent live-order text between the existing Back and Exit.\n   A real button for TV remote navigation; no cards, badges, motion or spinner. */\n.qb-bottom-nav .qb-footer-tracking {\n  display: flex;\n  flex: 1 1 auto;\n  min-width: 0;\n  max-width: 270px;\n  min-height: 52px;\n  flex-direction: column;\n  justify-content: center;\n  align-items: center;\n  gap: 3px;\n  margin: 0 10px;\n  padding: 6px 8px;\n  border: 1px solid transparent;\n  border-radius: 10px;\n  background: transparent;\n  color: var(--qb-text-primary);\n  text-align: center;\n  cursor: pointer;\n}\n\n.qb-bottom-nav .qb-footer-tracking-status {\n  display: block;\n  max-width: 100%;\n  overflow: hidden;\n  color: inherit;\n  font-size: clamp(10px, .78vw, 13px);\n  font-weight: 600;\n  line-height: 1.25;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.qb-bottom-nav .qb-footer-tracking-eta {\n  color: var(--qb-text-secondary);\n  font-size: clamp(10px, .72vw, 12px);\n  font-weight: 500;\n  line-height: 1.15;\n  white-space: nowrap;\n}\n\n/* Focus indication for Samsung remotes without turning status into a card. */\n.qb-bottom-nav .qb-footer-tracking.is-focused,\n.qb-bottom-nav .qb-footer-tracking:focus-visible {\n  border-color: var(--qb-orange-bright);\n  outline: none;\n  box-shadow: inset 0 -2px 0 var(--qb-orange-bright);\n}\n\n@media (max-width: 900px) {\n  .qb-bottom-nav .qb-footer-tracking {\n    margin: 0 4px;\n    padding: 6px 3px;\n  }\n}\n"
const T = "import assert from 'node:assert/strict'\nimport test from 'node:test'\nimport { normalizeTrackingSnapshot, trackingFooter, screenForTracking } from './tracking.js'\ntest('order footer shows precise status, ETA and route', () => {\n  const descriptor = { server: 'zomato', kind: 'food', order_id: '8261234567' }\n  const actual = normalizeTrackingSnapshot({ found: true, step: 'Rider assigned', eta_minutes: 11 })\n  assert.deepEqual(trackingFooter(actual, descriptor), {\n    status: 'Rider assigned', eta: '11 min', phase: 'preparing', screen: 'preparing',\n  })\n  assert.equal(screenForTracking({step: 'At the restaurant'}), 'preparing')\n  assert.equal(trackingFooter(null, descriptor), null)\n  assert.equal(trackingFooter(actual, null), null)\n})\ntest('delivered footer keeps final status, not stale ETA', () => {\n  assert.deepEqual(trackingFooter({step:'Delivered',eta:'10 min',done:true}, {server:'zomato'}), {\n    status:'Delivered',eta:'',phase:'delivered',screen:'delivered',\n  })\n})\n"
const root = process.cwd()
const panelFile = path.join(root, 'src/components/quickbite/QuickBitePanel.jsx')
const trackingFile = path.join(root, 'src/quickbite/tracking.js')
const cssFile = path.join(root, 'src/styles/orderTrackingFooter.css')
const testFile = path.join(root, 'src/quickbite/orderTrackingFooter.test.js')

function one(s, re, replacement, label) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g'
  const matches = [...s.matchAll(new RegExp(re.source, flags))]
  if (matches.length !== 1) throw Error(label + ': expected 1 match, got ' + matches.length)
  return s.replace(re, replacement)
}
function region(s, start, end, replacement, label) {
  const starts = [...s.matchAll(new RegExp(start.source, 'g'))]
  if (starts.length !== 1) throw Error(label + ': expected 1 start, got ' + starts.length)
  const a = starts[0].index
  const tail = a + starts[0][0].length
  const off = s.slice(tail).search(end)
  if (off < 0) throw Error(label + ': missing end')
  return s.slice(0, a) + replacement + '\n' + s.slice(tail + off)
}
function nl(source, value) { return source.includes('\r\n') ? value.replace(/\r?\n/g,'\r\n') : value }
function tracking(original) {
  let s = original
  if (!s.includes('export function trackingDisplay('))
    s = one(s, /export async function withTrackingTimeout\s*\(/, m => nl(s, D) + m, 'trackingDisplay')
  if (!s.includes('export function trackingFooter('))
    s = one(s, /export async function withTrackingTimeout\s*\(/, m => nl(s, F) + m, 'trackingFooter')
  if (!/export function screenForTracking\s*\(\s*snapshot\s*\)\s*\{\s*const phase\s*=\s*trackingDisplay\(/.test(s))
    s = one(s, /(export function screenForTracking\s*\(\s*snapshot\s*\)\s*\{\s*const phase\s*=\s*)trackingPhase\s*\(\s*snapshot\s*\)/,
      (_, prefix) => prefix + 'trackingDisplay(snapshot).phase', 'route tracking stage')
  return s
}
function component(original) {
  let s = original
  if (s.includes('qb-footer-tracking')) {
    if (!s.includes('trackingFooter(') || !s.includes('order-status')) throw Error('Partial tracking patch found')
    return s
  }
  s = one(s, /from ['"]\.\.\/\.\.\/quickbite\/tracking\.js['"]/,
    m => m + nl(s, "\nimport { trackingDisplay, trackingFooter } from '../../quickbite/tracking.js'"),
    'tracking import')
  s = one(s, /import\s*\{\s*commerceLog\s*\}\s*from\s*['"]\.\.\/\.\.\/quickbite\/commerceDiagnostics\.js['"]/,
    m => m + nl(s, "\nimport '../../styles/orderTrackingFooter.css'"), 'CSS import')
  s = region(s, /function\s+TrackingStepper\s*\(/, /function\s+LoadingState\s*\(/, nl(s, S), 'precise stepper')
  s = region(s, /function\s+renderTrackingScreen\s*\(/, /function\s+renderCancelled\s*\(/, nl(s, R), 'precise tracking screen')
  s = one(s, /const\s+trackingSnapshot\s*=\s*checkoutWithoutTracking\s*\?\s*null\s*:\s*trackingState\?\.snapshot/,
    m => m + nl(s, "\n    const footerTracking = trackingFooter(trackingSnapshot, activeOrder?.tracking)\n    const hasLiveFooter = Boolean(footerTracking)"), 'footer state')
  s = one(s, /const\s+livePhase\s*=\s*trackingPhase\s*\(\s*trackingSnapshot\s*,?\s*\)/,
    () => 'const livePhase = trackingDisplay(trackingSnapshot).phase', 'phase consistency')
  s = one(s, /const\s+valid\s*=\s*\[\s*\.\.\.contentKeys\s*,\s*['"]back['"]\s*,\s*['"]exit['"]\s*\]/,
    () => "const valid = [...contentKeys, 'back', ...(hasLiveFooter ? ['order-status'] : []), 'exit']", 'footer valid focus')
  s = one(s, /\[\s*open\s*,\s*confirmStrip\s*,\s*contentKeys\s*,\s*storedFocusKey\s*\]\s*\)/,
    () => '[open, confirmStrip, contentKeys, storedFocusKey, hasLiveFooter])', 'footer focus dependency')
  const activate = "\n      if (key === 'order-status' && footerTracking) {\n" +
    "        const target = footerTracking.screen\n" +
    "        const focus = ['preparing', 'on-the-way', 'pay'].includes(target) ? 'refresh-tracking' : 'shop-more'\n" +
    "        return setScreenAndFocus(target, focus)\n" +
    "      }\n"
  s = one(s, /function\s+activate\s*\(\s*key\s*\)\s*\{/,
    m => m + nl(s, activate), 'open tracking on select')
  const navigate = "\n      // Back -> Status -> Exit, falling back to Back -> Exit when no order.\n" +
    "      if ((key === 'ArrowLeft' || key === 'ArrowRight') &&\n" +
    "          ['back', 'order-status', 'exit'].includes(focusKey)) {\n" +
    "        const row = ['back', ...(footerTracking ? ['order-status'] : []), 'exit']\n" +
    "        const i = Math.max(0, row.indexOf(focusKey))\n" +
    "        const next = Math.max(0, Math.min(row.length - 1, i + (key === 'ArrowRight' ? 1 : -1)))\n" +
    "        setFocusKey(row[next])\n" +
    "        return\n" +
    "      }\n"
  s = one(s, /function\s+handleDirectionalKey\s*\(\s*key\s*,?\s*\)\s*\{/,
    m => m + nl(s, navigate), 'footer arrow keys')
  s = one(s, /const\s+all\s*=\s*\[\s*\.\.\.contentKeys\s*,\s*['"]back['"]\s*,\s*['"]exit['"]\s*,?\s*\]/,
    () => "const all = [...contentKeys, 'back', ...(hasLiveFooter ? ['order-status'] : []), 'exit']", 'footer focus order')
  const button = "\n          {footerTracking && (\n" +
    "            <button type=\"button\" className={'qb-footer-tracking' + (focusKey === 'order-status' ? ' is-focused' : '')}\n" +
    "              {...focusableProps('order-status')}\n" +
    "              aria-label={'View order tracking: ' + footerTracking.status + (footerTracking.eta ? ', ETA ' + footerTracking.eta : '')}>\n" +
    "              <span className=\"qb-footer-tracking-status\">{footerTracking.status}</span>\n" +
    "              {footerTracking.eta && <span className=\"qb-footer-tracking-eta\">{footerTracking.eta}</span>}\n" +
    "            </button>\n" +
    "          )}\n"
  s = one(s, /(<\/button>\s*)(<button\s+className=\{\x60qb-exit-button)/,
    (_, previous, next) => previous + nl(s, button) + next, 'insert footer between Back and Exit')
  if (!s.includes("...(hasLiveFooter ? ['order-status'] : [])"))
    throw Error('Generated remote navigation is incomplete')
  return s
}
function main() {
  if (!fs.existsSync(panelFile) || !fs.existsSync(trackingFile))
    throw Error('Run from the tv-frontend directory containing src/')
  const beforePanel = fs.readFileSync(panelFile, 'utf8')
  const beforeTracking = fs.readFileSync(trackingFile, 'utf8')
  const afterPanel = component(beforePanel)
  const afterTracking = tracking(beforeTracking)
  if (fs.existsSync(cssFile) && fs.readFileSync(cssFile, 'utf8') !== C)
    throw Error('orderTrackingFooter.css differs; refusing to overwrite')
  const files = [
    [panelFile, beforePanel, afterPanel],
    [trackingFile, beforeTracking, afterTracking]
  ]
  const pending = files.filter(([p,a,b]) => a !== b).map(([p]) => path.relative(root,p))
  if (!fs.existsSync(cssFile)) pending.push(path.relative(root,cssFile))
  if (!fs.existsSync(testFile)) pending.push(path.relative(root,testFile))
  if (process.argv.includes('--check')) {
    console.log('Valid patch; planned: ' + (pending.join(', ') || 'already applied'))
    return
  }
  if (!pending.length) { console.log('Already applied'); return }
  const backup = path.join(root, '.order-tracking-backup-' + Date.now())
  fs.mkdirSync(backup, {recursive:true})
  for (const [file, original, updated] of files) {
    if (original === updated) continue
    fs.copyFileSync(file, path.join(backup, path.basename(file)))
    fs.writeFileSync(file, updated)
  }
  if (!fs.existsSync(cssFile)) fs.writeFileSync(cssFile, C)
  if (!fs.existsSync(testFile)) fs.writeFileSync(testFile, T)
  console.log('Applied tracking footer. Originals backed up at: ' + backup)
  console.log('Next run: npm test and npm run build')
}
try { main() } catch(e) { console.error('Patch aborted: ' + e.message); process.exitCode = 1 }
