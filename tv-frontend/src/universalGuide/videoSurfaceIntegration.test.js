import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const host = readFileSync(new URL('./UniversalGuidePlayer.jsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('./UniversalGuideHome.jsx', import.meta.url), 'utf8')
const player = readFileSync(new URL('../components/VideoPlayer.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./universalGuide.css', import.meta.url), 'utf8')

test('one live video is mounted as a sibling of the scaled home and shopping panel', () => {
  assert.match(host, /className="ug-live-video-surface"/)
  assert.match(host, /<VideoPlayer \{\.\.\.playerProps\} compactMode commerceOverlay=\{null\}/)
  assert.match(host, /videoAnchorRef=\{videoAnchorRef\}/)
  assert.match(home, /ref=\{videoAnchorRef\} className="card-poster-wrap ug-video-tile"/)
  assert.doesNotMatch(host, /nowPlaying=\{<VideoPlayer/)
  assert.doesNotMatch(home, /\{nowPlaying\}/)
  assert.ok(host.indexOf('className="ug-live-video-surface"') <
    host.indexOf('ug-commerce-host'), 'the commerce overlay must remain above the video')
})

test('embedded video has no second provider-panel squeeze or forced CSS transform', () => {
  assert.match(player, /paneOpen && !compactMode \? ' vp-commerce-open'/)
  assert.match(css, /\.ug-player \.ug-live-video-surface \{/)
  assert.match(css, /transform: none !important;/)
  assert.match(css, /\.ug-player \.ug-live-video-surface \.vp-stage,/)
  assert.match(css, /\.ug-player \.ug-live-video-surface \.vp-media \{/)
  assert.match(css, /z-index: 3;/)
})

test('QuickBite opening preserves deliberate pause and never remounts the source', () => {
  assert.match(player, /shouldPlayRef\.current = false/)
  assert.match(player, /shouldPlayRef\.current = true/)
  assert.match(player, /if \(!video \|\| !videoSrc \|\| mediaError \|\| !shouldPlayRef\.current\) return/)
  assert.match(player, /if \(!paneOpen \|\| !shouldPlayRef\.current \|\| document\.hidden\) return/)
  assert.match(host, /fullscreenWidth: paneOpen \? stage\.getBoundingClientRect\(\)\.width : null/)
})
