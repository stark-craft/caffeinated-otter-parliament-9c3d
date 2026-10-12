// Run with Node from the extracted package. Without --apply this only checks.
const fs = require('node:fs')
const path = require('node:path')

try {
  const target = process.argv[2]
  if (!target || target.startsWith('--')) throw new Error('Usage: node apply-windows-update.cjs "C:\\commagent\\tv-frontend" [--apply]')
  const root = path.resolve(target)
  const appPath = path.join(root, 'src', 'App.jsx')
  let app = fs.readFileSync(appPath, 'utf8')
  if (app.includes("from './universalGuide/useLoginContinuation.js'")) {
    throw new Error('App already imports login continuation. Review its existing integration instead of applying this older-Windows patch again.')
  }
  const crlf = app.includes('\r\n')
  const edits = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-edits.json'), 'utf8'))
  for (const [index, edit] of edits.entries()) {
    // Preserve untouched PC formatting; tolerate whitespace in the supplied
    // anchors. Every anchor must match exactly once before any file is written.
    const indent = edit.old.match(/^[\t ]+/)?.[0] || ''
    const escaped = edit.old.slice(indent.length).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Leading indentation may not consume the preceding statement's newline.
    const pattern = new RegExp((indent ? '[\\t ]*' : '') + escaped.replace(/\s+/g, '\\s*'), 'g')
    const matches = [...app.matchAll(pattern)]
    if (matches.length !== 1) {
      throw new Error(`App edit ${index + 1} matched ${matches.length} locations. No files changed. Compare App.windows-login-continuation.patch with your current App.jsx.`)
    }
    const match = matches[0]
    const replacement = crlf ? edit.new.replace(/\n/g, '\r\n') : edit.new
    app = app.slice(0, match.index) + replacement + app.slice(match.index + match[0].length)
  }
  const writes = new Map([['src/App.jsx', app]])
  const panelRelative = 'src/components/quickbite/QuickBitePanel.jsx'
  let panel = fs.readFileSync(path.join(root, panelRelative), 'utf8')
  const panelCrlf = panel.includes('\r\n')
  const beforePaint = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*if\s*\(\s*!externalRequest\?\.nonce\s*\)/g
  const alreadyBeforePaint = /useLayoutEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*if\s*\(\s*!externalRequest\?\.nonce\s*\)/g
  const panelMatches = [...panel.matchAll(beforePaint)]
  if (panelMatches.length === 1) {
    if (!/\buseLayoutEffect\b/.test(panel.split(/from\s*['"]react['"]/)[0])) {
      if ((panel.match(/\buseImperativeHandle\s*,/g) || []).length !== 1) throw new Error('Panel React import differs. No files changed; review QuickBitePanel.before-paint.patch.')
      const insertion = panelCrlf ? 'useLayoutEffect,\r\n  useImperativeHandle,' : 'useLayoutEffect,\n  useImperativeHandle,'
      panel = panel.replace(/\buseImperativeHandle\s*,/, insertion)
    }
    panel = panel.replace(beforePaint, matched => matched.replace('useEffect', 'useLayoutEffect'))
    writes.set(panelRelative, panel)
  } else if (panelMatches.length !== 0 || [...panel.matchAll(alreadyBeforePaint)].length !== 1) {
    throw new Error('Panel request effect differs. No files changed; review QuickBitePanel.before-paint.patch.')
  }
  for (const file of ['UniversalGuidePlayer.jsx', 'universalGuide.css', 'useProductShortcut.js', 'useLoginContinuation.js']) {
    const relative = `src/universalGuide/${file}`
    writes.set(relative, fs.readFileSync(path.join(__dirname, 'tv-frontend', relative), 'utf8'))
  }
  console.log(`Validated ${edits.length} focused App edits. Files to update:`)
  for (const relative of writes.keys()) console.log(`  ${path.join(root, relative)}`)
  if (!process.argv.includes('--apply')) {
    console.log('Check only: no files changed. Add --apply to back up existing files and install.')
    process.exit(0)
  }
  const backup = path.join(root, 'backups', `tv-ui-login-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  for (const relative of writes.keys()) {
    const original = path.join(root, relative)
    if (fs.existsSync(original)) {
      const saved = path.join(backup, relative)
      fs.mkdirSync(path.dirname(saved), { recursive: true })
      fs.copyFileSync(original, saved)
    }
  }
  for (const [relative, contents] of writes) {
    const destination = path.join(root, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, contents, 'utf8')
  }
  console.log(`Installed. Original files backed up to ${backup}`)
  console.log('Panel received only the before-paint hook edit. Its remaining code and formatting were preserved. API/STT/QR-generation files, video and logo assets were not replaced. Run your frontend build and check the UI.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
