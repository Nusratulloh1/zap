// Извлекает 25 экранов дизайна из zap-bundle-src.dc.html в standalone-страницы
// design-reference/screens/*.html + скриншоты design-reference/png/*.png (эталоны паритета).
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const log = (msg) => appendFileSync('extract-progress.log', msg + '\n')
process.on('uncaughtException', (e) => {
  log('UNCAUGHT: ' + (e.stack || e))
  process.exit(1)
})
process.on('unhandledRejection', (e) => {
  log('REJECTION: ' + (e && (e.stack || e)))
  process.exit(1)
})
log('start')

const root = fileURLToPath(new URL('..', import.meta.url))
log('root=' + root)
const srcDir = `${root}source/Copy of Приложение СПЛИТ оплат`
const outDir = `${root}design-reference`
const html = readFileSync(`${srcDir}/zap-bundle-src.dc.html`, 'utf8')
log('html len=' + html.length)

mkdirSync(`${outDir}/screens`, { recursive: true })
mkdirSync(`${outDir}/png`, { recursive: true })
mkdirSync(`${outDir}/assets`, { recursive: true })
log('dirs made')
// ручное копирование: cpSync (нативный copyfile) в этом окружении молча убивает процесс
for (const dir of ['avatars', 'uploads']) {
  mkdirSync(`${outDir}/assets/${dir}`, { recursive: true })
  for (const f of readdirSync(`${srcDir}/${dir}`)) {
    writeFileSync(`${outDir}/assets/${dir}/${f}`, readFileSync(`${srcDir}/${dir}/${f}`))
  }
  log('copied ' + dir)
}
if (existsSync(`${srcDir}/promo-hero.png`)) {
  writeFileSync(`${outDir}/assets/promo-hero.png`, readFileSync(`${srcDir}/promo-hero.png`))
}
log('assets copied')

const screenRe = /<div id="([a-z0-9]+)" style="display: flex; flex-direction: column; gap: 14px/g
const screens = []
let m
while ((m = screenRe.exec(html))) screens.push({ id: m[1], start: m.index })

for (let i = 0; i < screens.length; i++) {
  const { id, start } = screens[i]
  const end = i + 1 < screens.length ? screens[i + 1].start : html.length
  const block = html.slice(start, end)

  const label =
    block.match(/<div style="font-size: 13px; font-weight: 600; color: #8A887E;">(.*?)<\/div>/)?.[1] ?? id
  const importOpen = block.match(/<x-import[^>]*>/)
  const dark = /dark=/.test(importOpen?.[0] ?? '')
  const bodyStart = block.indexOf(importOpen[0]) + importOpen[0].length
  const bodyEnd = block.indexOf('</x-import>')
  let body = block.slice(bodyStart, bodyEnd)

  body = body
    .replaceAll('src="avatars/', 'src="../assets/avatars/')
    .replaceAll('src="uploads/', 'src="../assets/uploads/')
    .replaceAll('src="promo-hero.png"', 'src="../assets/promo-hero.png"')
    .replaceAll("url('avatars/", "url('../assets/avatars/")
    .replaceAll("url('uploads/", "url('../assets/uploads/")

  const page = `<!doctype html>
<html><head><meta charset="utf-8">
<title>${id} — ${label}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 24px; background: #555; font-family: 'Manrope', sans-serif; display: flex; justify-content: center; }
  [data-scroll]::-webkit-scrollbar { display: none; }
  #frame { width: 402px; height: 874px; border-radius: 44px; overflow: hidden; position: relative; background: ${dark ? '#000' : '#EFEDE6'}; flex-shrink: 0; }
  #frame > .content { height: 100%; overflow: auto; scrollbar-width: none; }
  #frame > .content::-webkit-scrollbar { display: none; }
</style>
</head><body>
<div id="frame"><div class="content">
${body}
</div></div>
</body></html>`

  writeFileSync(`${outDir}/screens/${id}.html`, page)
  screens[i].label = label
  screens[i].dark = dark
}

writeFileSync(
  `${outDir}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>ZAP design reference</title><body style="font-family:sans-serif"><h1>Экраны дизайна</h1><ul>` +
    screens.map((s) => `<li><a href="screens/${s.id}.html">${s.id}</a> — ${s.label}</li>`).join('\n') +
    `</ul>`,
)

log(`extracted ${screens.length} screens: ` + screens.map((s) => s.id).join(', '))

// скриншоты-эталоны
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await (await browser.newContext({ viewport: { width: 460, height: 940 }, deviceScaleFactor: 1 })).newPage()
for (const s of screens) {
  await page.goto('file://' + `${outDir}/screens/${s.id}.html`.replaceAll('\\', '/'))
  await page.waitForTimeout(700)
  const frame = page.locator('#frame')
  await frame.screenshot({ path: `${outDir}/png/${s.id}.png` })
}
await browser.close()
log('reference PNGs done')
