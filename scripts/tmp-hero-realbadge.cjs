// Hero с НАСТОЯЩИМ бейджем ×2, вырезанным из дизайнерского promo-hero.
const fs = require('fs')
const sharp = require('sharp')
const SC = 'C:/Users/user/AppData/Local/Temp/claude/d--Projects-TreeThree-zap-split/9825637d-a0bc-4881-a7bb-54d4e9512899/scratchpad'
const PEACH = '#FFDEB7'

async function emblem(height) {
  const raw = await sharp(`${SC}/safia-logo.png`).resize({ height }).png().toBuffer()
  const m = await sharp(raw).metadata()
  const circ = Buffer.from(
    `<svg width="${m.width}" height="${m.height}"><circle cx="${m.width / 2}" cy="${m.height / 2}" r="${Math.min(m.width, m.height) / 2 - 1}" fill="#fff"/></svg>`,
  )
  return sharp(raw).composite([{ input: circ, blend: 'dest-in' }]).png().toBuffer()
}

async function rounded(w, h, r, bg, logoBuf) {
  const m = await sharp(logoBuf).metadata()
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`)
  const flat = await sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: logoBuf, left: Math.round((w - m.width) / 2), top: Math.round((h - m.height) / 2) }])
    .png()
    .toBuffer()
  return sharp(flat).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

;(async () => {
  // настоящий бейдж: правая часть вырезки, трим, лёгкое сглаживание даунскейлом
  const badge = await sharp(`${SC}/design-badge-cut.png`)
    .extract({ left: 88, top: 0, width: 152, height: 160 })
    .trim({ threshold: 1 })
    .resize({ width: 132 })
    .png()
    .toBuffer()
  const bMeta = await sharp(badge).metadata()

  const tex = await sharp(fs.readFileSync(`${SC}/texnomart-logo.svg`), { density: 300 }).resize({ width: 236 }).toBuffer()
  const sym = fs.readFileSync(`${SC}/idea-symbol.txt`, 'utf8')
  const inner = sym.replace(/^<symbol[^>]*>/, '').replace(/<\/symbol>$/, '')
  const ideaWhite = await sharp(
    Buffer.from(`<svg width="105" height="42" viewBox="0 0 105 42" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`),
    { density: 300 },
  )
    .resize({ width: 196 })
    .toBuffer()

  const rot = (buf, deg) => sharp(buf).rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const texCard = await rot(await rounded(330, 196, 30, '#FBC100', tex), -10)
  const ideaCard = await rot(await rounded(330, 196, 30, '#E9459A', ideaWhite), 10)
  const safiaCard = await rot(await rounded(360, 224, 32, PEACH, await emblem(168)), -2)

  const CANVAS_W = 940
  const CANVAS_H = 400
  const texMeta = await sharp(texCard).metadata()
  const ideaMeta = await sharp(ideaCard).metadata()
  const safiaMeta = await sharp(safiaCard).metadata()
  const safiaTop = CANVAS_H - safiaMeta.height - 12
  const sideTop = CANVAS_H - texMeta.height - 4

  const composed = await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: texCard, left: 26, top: sideTop },
      { input: ideaCard, left: CANVAS_W - 26 - ideaMeta.width, top: sideTop },
      { input: safiaCard, left: Math.round((CANVAS_W - safiaMeta.width) / 2), top: safiaTop },
      { input: badge, left: Math.round((CANVAS_W - bMeta.width) / 2), top: Math.max(2, safiaTop - Math.round(bMeta.height / 2)) },
    ])
    .png()
    .toBuffer()
  const trimmed = await sharp(composed).trim({ threshold: 1 }).png().toBuffer()
  await sharp(trimmed).toFile('d:/Projects/TreeThree/zap_split/src/assets/brand/promo-hero.png')
  console.log('hero with real badge done', (await sharp(trimmed).metadata()).width)
})()
