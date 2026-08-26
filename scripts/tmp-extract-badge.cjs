// Вырезает НАСТОЯЩИЙ бейдж ×2 из дизайнерского promo-hero:
// маска = лаймовые пиксели + тёмные пиксели, окружённые лаймом (текст ×2).
const sharp = require('sharp')
const SC = 'C:/Users/user/AppData/Local/Temp/claude/d--Projects-TreeThree-zap-split/9825637d-a0bc-4881-a7bb-54d4e9512899/scratchpad'

const isLime = (r, g, b) => g > 200 && r > 160 && r < 245 && b < 130 && g - b > 90
const isDark = (r, g, b, a) => a > 200 && r < 90 && g < 90 && b < 90

;(async () => {
  const src = 'd:/Projects/TreeThree/zap_split/source/Copy of Приложение СПЛИТ оплат/promo-hero.png'
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const px = (x, y) => {
    const i = (y * W + x) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }

  // bbox лайма
  let minX = W, minY = H, maxX = 0, maxY = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = px(x, y)
      if (a > 200 && isLime(r, g, b)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  console.log('lime bbox:', minX, minY, maxX, maxY)

  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const out = Buffer.alloc(bw * bh * 4)

  // лайм-карта для проверки «окружён лаймом»
  const limeAt = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false
    const [r, g, b, a] = px(x, y)
    return a > 200 && isLime(r, g, b)
  }
  const enclosed = (x, y) => {
    let L = false, R = false, U = false, D = false
    for (let i = x - 1; i >= minX; i--) if (limeAt(i, y)) { L = true; break }
    for (let i = x + 1; i <= maxX; i++) if (limeAt(i, y)) { R = true; break }
    for (let j = y - 1; j >= minY; j--) if (limeAt(x, j)) { U = true; break }
    for (let j = y + 1; j <= maxY; j++) if (limeAt(x, j)) { D = true; break }
    return L && R && U && D
  }

  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const [r, g, b, a] = px(x, y)
      const keep = (a > 200 && isLime(r, g, b)) || (isDark(r, g, b, a) && enclosed(x, y))
      const o = ((y - minY) * bw + (x - minX)) * 4
      if (keep) {
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255
      }
    }

  await sharp(out, { raw: { width: bw, height: bh, channels: 4 } }).png().toFile(`${SC}/design-badge-cut.png`)
  console.log('badge extracted:', bw + 'x' + bh)
})()
