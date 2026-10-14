// Keep the hardware-decoded video outside the transformed Universal Guide
// home. Derive its screen-space position from the ordinary Now Playing tile.
// Pure calculations, so layout can be regression tested without a browser.
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0

function rect(value) {
  if (!value) return null
  const left = number(value.left ?? value.x)
  const top = number(value.top ?? value.y)
  const width = Math.max(0, number(value.width))
  const height = Math.max(0, number(value.height))
  return { left, top, right: left + width, bottom: top + height, width, height }
}

export function videoSurfaceGeometry({ root, tile, clips = [], fullscreen = false, fullscreenWidth = null, hidden = false } = {}) {
  const bounds = rect(root)
  if (!bounds || !bounds.width || !bounds.height) return null
  if (fullscreen) return {
    left: 0, top: 0, width: fullscreenWidth == null ? bounds.width : Math.max(0, number(fullscreenWidth)), height: bounds.height,
    clipPath: 'none',
  }
  const target = rect(tile)
  if (hidden || !target || !target.width || !target.height) return null

  let visibleLeft = target.left
  let visibleTop = target.top
  let visibleRight = target.right
  let visibleBottom = target.bottom
  for (const box of [bounds, ...clips.map(rect).filter(Boolean)]) {
    visibleLeft = Math.max(visibleLeft, box.left)
    visibleTop = Math.max(visibleTop, box.top)
    visibleRight = Math.min(visibleRight, box.right)
    visibleBottom = Math.min(visibleBottom, box.bottom)
  }
  if (visibleRight - visibleLeft < 1 || visibleBottom - visibleTop < 1) return null

  // Do not resize the decoded video to a clipped viewport: preserve its
  // aspect ratio and crop it via clip-path instead.
  const topClip = Math.max(0, visibleTop - target.top)
  const rightClip = Math.max(0, target.right - visibleRight)
  const bottomClip = Math.max(0, target.bottom - visibleBottom)
  const leftClip = Math.max(0, visibleLeft - target.left)
  return {
    left: target.left - bounds.left,
    top: target.top - bounds.top,
    width: target.width,
    height: target.height,
    clipPath: topClip || rightClip || bottomClip || leftClip
      ? `inset(${topClip}px ${rightClip}px ${bottomClip}px ${leftClip}px)` : 'none',
  }
}
