// Превращает новый лендинг (ZAP Landing.dc.html: GSAP + Lenis + пиннинг)
// в статичные фрагменты холста.
//
// Почему не «как есть»: внутри артефакта CSP не пускает CDN, поэтому GSAP не
// стартует — а половина вёрстки живёт с opacity:0 до анимации. Поэтому здесь
// доигрываются конечные состояния, пиннинг разворачивается в восемь рядов,
// vh/vw и медиазапросы «запекаются» под нужный вьюпорт, а длинная страница
// режется на колонки: артборд холста обрезает всё выше 8000 px.
//
// Выход: parts/nl-desktop-N.html, parts/nl-mobile-N.html, parts/nl-modal.html
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const SRC = new URL('./new-landing/ZAP Landing.dc.html', import.meta.url)
const src = readFileSync(SRC, 'utf8')

const styleSrc = src.split('<style>')[1].split('</style>')[0]
const bodySrc = src.split('<x-dc>')[1].split('</x-dc>')[0]

/** clamp()/min()/max() и vh/vw → px под конкретный вьюпорт */
function resolveUnits(css, VW, VH) {
  const px = (s) => {
    const t = s.trim()
    let m = t.match(/^(-?[\d.]+)vw$/)
    if (m) return (parseFloat(m[1]) * VW) / 100
    m = t.match(/^(-?[\d.]+)vh$/)
    if (m) return (parseFloat(m[1]) * VH) / 100
    m = t.match(/^(-?[\d.]+)px$/)
    if (m) return parseFloat(m[1])
    return null
  }
  const fn = (name, pick) =>
    css.replace(new RegExp(name + '\\(([^()]*)\\)', 'g'), (all, args) => {
      const nums = args.split(',').map(px)
      if (nums.some((n) => n === null)) return all
      return Math.round(pick(nums) * 100) / 100 + 'px'
    })
  css = fn('clamp', ([a, b, c]) => Math.min(Math.max(b, a), c))
  css = fn('min', (n) => Math.min(...n))
  css = fn('max', (n) => Math.max(...n))
  css = css.replace(/(-?[\d.]+)vh/g, (_, n) => Math.round(parseFloat(n) * VH) / 100 + 'px')
  css = css.replace(/(-?[\d.]+)vw/g, (_, n) => Math.round(parseFloat(n) * VW) / 100 + 'px')
  return css
}

/** убирает @media-блоки: их значения уже вписаны в элементы */
const stripMedia = (css) => css.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\}\s*)*\}/g, '')

const HEAD = `<meta charset="utf-8"><base href="../img/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`

// то, что переопределяют медиазапросы исходника — вписываем вычисленным
const BAKE = [
  ['[data-r="hero"]', ['grid-template-columns', 'gap', 'padding-top', 'padding-bottom']],
  ['[data-r="hero"] h1', ['font-size']],
  ['[data-r="herophone"]', ['width', 'height', 'margin', 'transform']],
  ['[data-r="pinrow"]', ['padding-top', 'padding-bottom', 'flex-direction', 'gap', 'align-items']],
  ['[data-r="pintext"]', ['order', 'max-width', 'text-align']],
  ['[data-r="dots"]', ['flex-direction', 'order']],
  ['[data-r="grid2"]', ['grid-template-columns']],
  ['[data-r="split"]', ['grid-template-columns']],
  ['[data-r="nav"]', ['display']],
  ['#zphone', ['height']],
]

const FIX = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s, c) => Array.from((c || document).querySelectorAll(s))

  // 0 · запекаем всё, что зависит от медиазапросов (артборд шире вьюпорта)
  const BAKE = ${JSON.stringify(BAKE)}
  BAKE.forEach(([sel, props]) => {
    qa(sel).forEach((el) => {
      const cs = getComputedStyle(el)
      props.forEach((p) => el.style.setProperty(p, cs.getPropertyValue(p)))
    })
  })

  // 1 · рантайм-хром страницы: прелоадер, курсор, полоса прогресса
  ;['#zpre', '#zcur', '#zring', '#zprog'].forEach((s) => q(s) && q(s).remove())
  // зерно-оверлей на весь вьюпорт: в артборде накрыло бы и подписи
  qa('div[style*="z-index:8000"]').forEach((el) => el.remove())

  // 2 · шапка стоит сверху полотна, а не липнет к вьюпорту
  const head = q('#zhead')
  if (head) { head.style.position = 'absolute'; head.style.top = '0' }

  // 3 · телефоны: JS подгонял экран 390×844 под рамку — считаем тот же масштаб
  const hero = q('#zhero-tilt')
  if (hero) {
    hero.style.position = 'relative'
    const hi = q('#zhero-inner')
    if (hi) hi.style.transform = 'scale(' + (hero.clientHeight - 20) / 844 + ')'
  }
  const phone = q('#zphone')
  const phoneScale = phone ? (phone.clientHeight - 20) / 844 : 0.8

  // 4 · «проблема»: строки перечёркиваются, финал проявляется
  qa('[data-sline="1"]').forEach((l) => { l.style.transform = 'scaleX(1)' })
  if (q('#zprob-final')) q('#zprob-final').style.opacity = '1'

  // 5 · пиннинг → восемь рядов подряд: в статике шаг за шагом
  const row = q('[data-r="pinrow"]')
  if (row) {
    const n = qa('[data-txt="1"]').length
    const host = q('#zpin')
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:88px;width:100%;padding:96px 0 60px'
    for (let i = 0; i < n; i++) {
      const r = row.cloneNode(true)
      r.style.padding = '0 48px'
      r.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
      qa('[data-dot="1"]', r).forEach((d, j) => {
        d.style.background = j === i ? '#DDFF33' : '#3E3C35'
        d.style.transform = j === i ? 'scaleX(2)' : 'scaleX(1)'
      })
      qa('[data-txt="1"]', r).forEach((t, j) => { if (j !== i) t.remove() })
      const keep = r.querySelector('[data-txt="1"]')
      if (keep) { keep.style.position = 'relative'; keep.style.inset = 'auto'; keep.style.opacity = '1' }
      const pt = r.querySelector('[data-r="pintext"]')
      if (pt) pt.style.minHeight = 'auto'
      qa('[data-scr="1"]', r).forEach((s, j) => { if (j !== i) s.remove() })
      const ks = r.querySelector('[data-scr="1"]')
      if (ks) ks.style.opacity = '1'
      const inner = r.querySelector('div[style*="transform-origin:0 0"]')
      if (inner) inner.style.transform = 'scale(' + phoneScale + ')'
      wrap.appendChild(r)
    }
    row.remove()
    const how = q('#how')
    Array.from(wrap.children).forEach((r, i) => {
      const sec = document.createElement('section')
      sec.style.cssText = 'position:relative;background:#111110;padding:' + (i === 0 ? 96 : 44) + 'px 0 44px'
      sec.appendChild(r)
      how.parentNode.insertBefore(sec, how)
    })
    how.remove()
  }

  // 6 · дашборд мерчанта: счётчики и график в конечном состоянии
  if (q('#zk1')) q('#zk1').textContent = '142'
  if (q('#zk2')) q('#zk2').textContent = '860 000'
  if (q('#zchart')) q('#zchart').setAttribute('stroke-dashoffset', '0')

  // 7 · FAQ: первый ответ раскрыт — виден паттерн
  const acc = qa('[data-acc="1"]')[0]
  if (acc) {
    acc.querySelector('[data-accbody="1"]').style.height = 'auto'
    const plus = acc.querySelector('[data-plus="1"]')
    plus.style.transform = 'rotate(135deg)'
    plus.style.color = '#F5F3EE'
  }

  // 8 · модалка партнёра — отдельным блоком макета
  if (q('#zmodal')) q('#zmodal').remove()

  // 9 · картинки холста лежат плоским списком по имени файла
  qa('img').forEach((im) => {
    const s = im.getAttribute('src') || ''
    if (s.startsWith('assets/')) im.setAttribute('src', s.slice(7))
  })

  // 10 · нарезка по секциям верхнего уровня
  let root = document.body
  for (;;) {
    const tall = Array.from(root.children).filter((c) => c.getBoundingClientRect().height > 0)
    if (tall.length !== 1) break
    root = tall[0]
  }
  return Array.from(root.children).map((el) => ({
    html: el.outerHTML,
    h: Math.round(el.getBoundingClientRect().height),
    absolute: getComputedStyle(el).position === 'absolute',
  }))
})()`

let browser
for (const channel of ['chrome', 'msedge']) {
  try {
    browser = await chromium.launch({ channel, headless: true })
    break
  } catch {}
}
if (!browser) throw new Error('нет Chrome/Edge')

async function build(name, VW, VH, columns) {
  const css = stripMedia(resolveUnits(styleSrc, VW, VH))
  const html = resolveUnits(bodySrc, VW, VH)
  const tmp = new URL(`./parts/.tmp-${name}.html`, import.meta.url)
  writeFileSync(
    tmp,
    `<!doctype html><html><head>${HEAD}<style>${resolveUnits(styleSrc, VW, VH)}</style></head><body>${html}</body></html>`,
  )

  const page = await browser.newPage({ viewport: { width: VW, height: VH } })
  await page.route('**cdn.jsdelivr.net**', (r) => r.abort())
  await page.goto(tmp.href, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  const parts = await page.evaluate(FIX)
  console.log("  parts:", parts.length, parts.map((p) => p.h).join(","))
  await page.close()

  const total = parts.reduce((s, p) => s + p.h, 0)
  const target = total / columns
  const cols = [[]]
  let acc = 0
  for (const p of parts) {
    if (acc > 0 && acc + p.h / 2 > target && cols.length < columns) {
      cols.push([])
      acc = 0
    }
    cols[cols.length - 1].push(p)
    acc += p.h
  }

  const out = []
  cols.forEach((col, i) => {
    const h = col.reduce((s, p) => s + p.h, 0)
    const file = `${name}-${i + 1}`
    writeFileSync(
      new URL(`./parts/${file}.html`, import.meta.url),
      `<div style="width: ${VW}px; background: #111110; color: #F5F3EE; font-family: 'Manrope', Helvetica, Arial, sans-serif; position: relative; overflow: hidden">\n<style>${css}</style>\n${col.map((p) => p.html).join('\n')}\n</div>\n`,
    )
    out.push([file, VW, h])
    console.log(file, VW + '×' + h)
  })
  return out
}

const desktop = await build('nl-desktop', 1440, 900, 3)
const mobile = await build('nl-mobile', 390, 844, 4)

// модалка партнёра
const card = bodySrc.split('<div id="zmodal-card"')[1]
if (card) {
  const inner = '<div id="zmodal-card"' + card.split('\n  </div>\n\n</div>')[0]
  writeFileSync(
    new URL('./parts/nl-modal.html', import.meta.url),
    `<div style="width: 540px; background: #0E0E0C; padding: 40px; font-family: 'Manrope', Helvetica, Arial, sans-serif">\n${resolveUnits(inner, 1440, 900).replace(/assets\//g, '').replace('position:relative;width:100%;max-width:460px', 'position:relative;width:460px')}\n</div>\n`,
  )
  console.log('nl-modal')
}

await browser.close()
console.log(JSON.stringify({ desktop, mobile }))
