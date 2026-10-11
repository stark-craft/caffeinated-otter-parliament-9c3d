// node src/universalGuide/browser-regression.cjs http://127.0.0.1:5183 /tmp/ug-playback-test.mp4
// Supply a local moving MP4 fixture. All auth/commerce responses are mocked.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const base = process.argv[2] || 'http://127.0.0.1:5183'
const video = process.argv[3]
if (!video || !fs.existsSync(video)) throw new Error('Provide a local MP4 fixture as the second argument.')
const out = '/tmp/universal-guide-demo'
fs.mkdirSync(out, { recursive: true })
const panel = 'aside.qb-panel[aria-label="QuickBite food ordering"][aria-hidden="false"]'
const qrPanel = 'aside.qb-qr-panel[aria-hidden="false"]'

async function fixture(browser, connected = true, foodOnly = false) {
  const context = await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'})
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const state = {connected,foodOnly,complete:false,chats:[],qrCreates:0,errors:[]}
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('https://image.tmdb.org/**', route => route.abort())
  await page.route('**/video/tv-content.mp4', route => route.fulfill({path:video,contentType:'video/mp4'}))
  await page.route('**/src/hooks/useSamsungVoice.js*', route => route.fulfill({contentType:'application/javascript',
    body:'export function useSamsungVoice(){return {phase:"idle",micError:""};}'}))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body
    if(path === '/api/session') body={session_id:'DEMO-SESSION',platforms:state.connected?['Zepto']:state.foodOnly?['Zomato']:[]}
    else if(path.startsWith('/api/qr/auth/status/')) body={connected:path.endsWith('/zepto')?state.connected:path.endsWith('/zomato')&&state.foodOnly}
    else if(path === '/api/qr/session'){state.qrCreates++;body={session_id:'DEMO-PAIRING'}}
    else if(/\/api\/qr\/session\/[^/]+\/status$/.test(path)) body={login_complete:state.complete}
    else if(path === '/api/chat') {state.chats.push(route.request().postDataJSON());body={widget:'text',text:'Fixture product result'}}
    else throw new Error(`Unexpected request: ${path}`)
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(base,{waitUntil:'domcontentloaded'})
  await page.waitForFunction(()=>{const v=document.querySelector('.ug-now-playing video');return v?.readyState>=2&&!v.paused})
  await page.waitForTimeout(250)
  await page.evaluate(()=>{window.__demoVideo=document.querySelector('.ug-now-playing video')})
  return {page,state,context}
}
async function moving(f) {
  const before=await f.page.locator('.ug-now-playing video').evaluate(el=>el.currentTime)
  await f.page.waitForTimeout(550)
  assert.equal(await f.page.evaluate(()=>window.__demoVideo===document.querySelector('.ug-now-playing video')),true,'video instance must survive')
  const after=await f.page.locator('.ug-now-playing video').evaluate(el=>({time:el.currentTime,paused:el.paused,loop:el.loop}))
  assert.equal(after.paused,false);assert.equal(after.loop,true)
  assert.notEqual(after.time,before,'real moving video must advance')
  const dimensions=await f.page.evaluate(()=>{
    const tile=document.querySelector('.ug-video-tile').getBoundingClientRect()
    const video=document.querySelector('.ug-now-playing video').getBoundingClientRect()
    return {tileWidth:tile.width,tileHeight:tile.height,videoWidth:video.width,videoHeight:video.height}
  })
  assert.ok(Math.abs(dimensions.tileWidth-dimensions.videoWidth)<2,`whole video must fit the tile: ${JSON.stringify(dimensions)}`)
  assert.ok(Math.abs(dimensions.tileHeight-dimensions.videoHeight)<2,`video must not be viewport-sized and clipped: ${JSON.stringify(dimensions)}`)
}
async function hero(f,id) {
  await f.page.getByRole('button',{name:`Show ${id}`,exact:true}).click()
  await f.page.locator(`.ug-hero-slide[data-product-id="${id}"]`).click()
}
async function landing(f,id) {
  await f.page.locator(`${panel}[data-screen="gproduct"]`).waitFor()
  assert.equal(await f.page.locator(`${panel} .qb-dish-card.is-selected .qb-dish-name`).textContent(),id==='milk'?'Milk':'Chips')
  assert.equal(f.state.chats.length,0,'hero must not search or mutate commerce')
  assert.equal(await f.page.locator('.ug-home').getAttribute('inert'),'')
  assert.equal(await f.page.locator('.ug-home button:focus').count(),0)
  await moving(f)
}
async function finish(f) {assert.deepEqual(f.state.errors,[]);await f.context.close()}

;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
  try {
    const f=await fixture(browser)
    await f.page.screenshot({path:`${out}/01-for-you.png`})
    await f.page.getByRole('button',{name:'How I Met Your Mother',exact:true}).click()
    await f.page.keyboard.press('Enter')
    assert.equal(await f.page.locator('aside.qb-panel.is-open').count(),0)
    assert.equal(f.state.qrCreates,0);assert.equal(f.state.chats.length,0)
    for(const tab of ['Live','Apps','For You']){
      await f.page.getByRole('tab',{name:tab,exact:true}).click();await moving(f)
      if(tab!=='For You')await f.page.screenshot({path:`${out}/02-${tab.toLowerCase()}.png`})
    }
    assert.equal(await f.page.locator('video').count(),1)
    await f.page.keyboard.press('f')
    await f.page.waitForFunction(()=>document.fullscreenElement?.classList.contains('ug-player'))
    await moving(f)
    await f.page.keyboard.press('f')
    await f.page.waitForFunction(()=>!document.fullscreenElement)
    await f.page.locator('[data-ug-focus="hero"]').focus()
    await f.page.keyboard.press('ArrowRight')
    assert.equal(await f.page.locator('.ug-hero-slide').getAttribute('data-product-id'),'milk')
    await f.page.keyboard.press('ArrowDown')
    assert.equal(await f.page.locator('.ug-hero-dots button:focus').count(),1)
    await f.page.keyboard.press('ArrowDown')
    assert.equal(await f.page.locator('.ug-tabs button:focus').count(),1)
    assert.equal(await f.page.locator('aside.qb-panel.is-open').count(),0)
    await finish(f)
    console.log('PASS inert entertainment, home remote navigation and persistent moving video across all tabs')

    for(const id of ['milk','chips']){
      const f=await fixture(browser)
      await f.page.getByRole('button',{name:`Show ${id}`,exact:true}).click()
      await f.page.screenshot({path:`${out}/03-hero-${id}.png`})
      const width=await f.page.locator('.ug-home-frame').evaluate(el=>el.getBoundingClientRect().width)
      await f.page.locator('.ug-hero-slide').click();await landing(f,id)
      const nextWidth=await f.page.locator('.ug-home-frame').evaluate(el=>el.getBoundingClientRect().width)
      assert.ok(nextWidth<width)
      assert.equal(f.state.qrCreates,0)
      const qr=await f.page.locator(panel).boundingBox(),home=await f.page.locator('.ug-home-frame').boundingBox()
      assert.ok(qr.x>=home.x+home.width-1,'panel must sit beside home')
      await f.page.screenshot({path:`${out}/04-${id}-panel.png`})
      if(id==='chips') {
        await f.page.keyboard.press('f')
        await f.page.waitForFunction(()=>document.fullscreenElement?.querySelector('aside.qb-panel.is-open'))
        await moving(f)
        await f.page.keyboard.press('f')
        await f.page.waitForFunction(()=>!document.fullscreenElement)
      }
      if(id==='milk') {
        await f.page.locator(`${panel} [data-qb-focus="select-gproduct"]`).click()
        await f.page.waitForFunction(()=>document.querySelector('aside.qb-panel.is-open')?.dataset.screen==='gresults')
        assert.equal(f.state.chats.length,1,'only the explicit Find press should start discovery')
        assert.match(f.state.chats[0].message,/Milk/i)
      }
      await f.page.locator(`${panel} [data-qb-focus="exit"]`).click()
      await f.page.locator('.ug-shop-open').waitFor({state:'detached'})
      assert.equal(await f.page.locator('.ug-hero-slide:focus').count(),1)
      await moving(f)
      if(id==='chips') {
        // A closed overlay must not intercept the rightmost home card.
        await f.page.locator('[data-ug-focus="card-chips"]').click()
        await landing(f,'chips')
      }
      await finish(f)
      console.log(`PASS connected ${id} local landing, squeeze, playback and focus restoration`)
    }
    for(const id of ['milk','chips']){
      const f=await fixture(browser,false)
      await hero(f,id)
      await f.page.locator(qrPanel).waitFor()
      await f.page.locator(`${qrPanel} .qb-qr-code svg`).waitFor()
      assert.equal(await f.page.locator(panel).count(),0)
      assert.equal(f.state.qrCreates,1);assert.equal(f.state.chats.length,0)
      await moving(f)
      await f.page.screenshot({path:`${out}/05-${id}-qr.png`})
      f.state.connected=true;f.state.complete=true
      await landing(f,id)
      assert.equal(f.state.qrCreates,1)
      await finish(f)
      console.log(`PASS unauthenticated ${id} QR first, remembered landing after login, no chat`)
    }
    {
      const f=await fixture(browser,false,true)
      await hero(f,'chips');await f.page.locator(`${qrPanel} .qb-qr-code svg`).waitFor()
      assert.equal(await f.page.locator(panel).count(),0,'Food login cannot unlock Grocery')
      f.state.connected=true;f.state.complete=true;await landing(f,'chips')
      await finish(f);console.log('PASS Food-only account still requires Grocery pairing')
    }
    {
      const f=await fixture(browser,false)
      await hero(f,'milk');await f.page.locator(`${qrPanel} .qb-qr-code svg`).waitFor()
      await f.page.locator(`${qrPanel} [data-qb-focus="close"]`).click()
      await f.page.locator('.ug-shop-open').waitFor({state:'detached'})
      assert.equal(await f.page.locator('.ug-hero-slide:focus').count(),1)
      f.state.connected=true;f.state.complete=true
      await f.page.getByRole('button',{name:'Open Quick Shop',exact:false}).click()
      await f.page.locator(panel).waitFor()
      assert.equal(await f.page.locator(panel).getAttribute('data-screen'),'home','cancelled product shortcut must not resume')
      assert.equal(f.state.chats.length,0)
      await moving(f);await finish(f);console.log('PASS cancelled pairing drops pending product and preserves playback')
    }
    console.log('PASS all 7 Universal Guide browser scenarios')
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
