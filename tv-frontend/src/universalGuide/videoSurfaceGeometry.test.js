import test from 'node:test'
import assert from 'node:assert/strict'
import { videoSurfaceGeometry } from './videoSurfaceGeometry.js'

const screen = {left:0,top:0,width:1920,height:1080}
const video = {left:74,top:426,width:340,height:192}

test('Now Playing video follows the home tile precisely without CSS transforms', () => {
  assert.deepEqual(videoSurfaceGeometry({root:screen,tile:video,clips:[screen]}), {
    left:74,top:426,width:340,height:192,clipPath:'none',
  })
})

test('QuickBite squeeze changes geometry, not video identity or timeline', () => {
  const squeezed = videoSurfaceGeometry({root:screen,
    tile:{left:40,top:327,width:244,height:137},clips:[screen]})
  assert.equal(squeezed.width,244)
  assert.equal(squeezed.height,137)
  assert.equal(squeezed.left,40)
})

test('Scroll clips the video without resizing or stretching its original surface', () => {
  const clipped = videoSurfaceGeometry({root:screen,tile:video,clips:[
    {left:0,top:500,width:1920,height:580},
  ]})
  assert.equal(clipped.height,192)
  assert.equal(clipped.top,426)
  assert.equal(clipped.clipPath,'inset(74px 0px 0px 0px)')
})

test('Hidden tab suppresses the tile but full-screen viewing restores the same surface', () => {
  assert.equal(videoSurfaceGeometry({root:screen,tile:video,hidden:true}),null)
  assert.deepEqual(videoSurfaceGeometry({root:screen,tile:video,hidden:true,fullscreen:true}),{
    left:0,top:0,width:1920,height:1080,clipPath:'none',
  })
})

test('Offscreen tile never floats on top of unrelated recommended cards', () => {
  assert.equal(videoSurfaceGeometry({root:screen,tile:{
    left:74,top:-300,width:340,height:192,
  },clips:[screen]}),null)
})

test('full-video shopping view shrinks the media to the left stage without a transform', () => {
  const surface = videoSurfaceGeometry({root:screen,fullscreen:true,fullscreenWidth:1340})
  assert.deepEqual(surface,{left:0,top:0,width:1340,height:1080,clipPath:'none'})
})
