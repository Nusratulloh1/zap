// Генерирует PWA-иконки и фавиконки из реального логотипа-вордмарка на лаймовом фоне.
// Запуск: pnpm icons
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const LIME = '#DDFF33'
const wordmarkPath = fileURLToPath(new URL('../src/assets/brand/logo/zap-wordmark-large.png', import.meta.url))
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

await mkdir(new URL('../public', import.meta.url), { recursive: true })

/** лаймовый квадрат с вордмарком заданной ширины (доля от стороны), по центру */
async function icon(size, wordmarkRatio) {
  const targetW = Math.round(size * wordmarkRatio)
  const mark = await sharp(wordmarkPath).resize({ width: targetW }).toBuffer()
  const { height: markH } = await sharp(mark).metadata()
  return sharp({
    create: { width: size, height: size, channels: 4, background: LIME },
  })
    .composite([{ input: mark, left: Math.round((size - targetW) / 2), top: Math.round((size - markH) / 2) }])
    .png()
}

// full-bleed: скругление даёт маска ОС; 1024 — для чёткого Android-сплэша
await (await icon(192, 0.78)).toFile(out('icon-192.png'))
await (await icon(512, 0.78)).toFile(out('icon-512.png'))
await (await icon(1024, 0.78)).toFile(out('icon-1024.png'))
// maskable: вордмарк 64% — максимум, при котором диагональ (аспект 1.5:1)
// остаётся внутри круглой safe zone 80%
await (await icon(192, 0.64)).toFile(out('icon-maskable-192.png'))
await (await icon(512, 0.64)).toFile(out('icon-maskable-512.png'))
// apple-touch: full-bleed, БЕЗ прозрачности и скруглений (iOS скругляет сам)
await (await icon(180, 0.78)).flatten({ background: LIME }).toFile(out('apple-touch-icon.png'))

// favicon-32.png + favicon.ico (ICO-обёртка вокруг 32px PNG)
const fav32 = await (await icon(32, 0.86)).toBuffer()
await writeFile(out('favicon-32.png'), fav32)

const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0) // reserved
icoHeader.writeUInt16LE(1, 2) // type: icon
icoHeader.writeUInt16LE(1, 4) // count
const icoEntry = Buffer.alloc(16)
icoEntry.writeUInt8(32, 0) // width
icoEntry.writeUInt8(32, 1) // height
icoEntry.writeUInt16LE(1, 4) // planes
icoEntry.writeUInt16LE(32, 6) // bpp
icoEntry.writeUInt32LE(fav32.length, 8)
icoEntry.writeUInt32LE(22, 12) // offset: 6 + 16
await writeFile(out('favicon.ico'), Buffer.concat([icoHeader, icoEntry, fav32]))

// favicon.svg: лаймовый квадрат rx=20% + вордмарк ~72% ширины, встроенный base64
const svgMark = await sharp(wordmarkPath).resize({ width: 256 }).png().toBuffer()
const { width: smW, height: smH } = await sharp(svgMark).metadata()
const box = 100
const w = 72
const h = (w * smH) / smW
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">
  <rect width="${box}" height="${box}" rx="${box * 0.2}" fill="${LIME}"/>
  <image href="data:image/png;base64,${svgMark.toString('base64')}" x="${(box - w) / 2}" y="${((box - h) / 2).toFixed(2)}" width="${w}" height="${h.toFixed(2)}"/>
</svg>
`
await writeFile(out('favicon.svg'), svg)

// проверка maskable: вордмарк должен пережить круглый кроп (safe zone — круг 80% диаметра)
{
  const size = 512
  const { data, info } = await (await icon(size, 0.55)).raw().toBuffer({ resolveWithObject: true })
  const r = (size * 0.8) / 2
  const cx = size / 2
  let outside = 0
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const i = (y * info.width + x) * info.channels
      // «чернильные» пиксели вордмарка за пределами safe-круга
      const dark = data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100
      if (dark && Math.hypot(x - cx, y - cx) > r) outside++
    }
  }
  console.log(outside === 0 ? 'maskable: вордмарк в safe zone ✓' : `maskable: ${outside} тёмных пикселей за safe zone ✗`)
}

// ---------- iOS splash: лайм + вордмарк ~40% ширины, точная матрица устройств ----------
// Safari игнорирует manifest-splash; без точных size+media — белая вспышка при старте.
export const SPLASH_MATRIX = [
  { w: 1170, h: 2532, dw: 390, dh: 844, dpr: 3 },
  { w: 1179, h: 2556, dw: 393, dh: 852, dpr: 3 },
  { w: 1290, h: 2796, dw: 430, dh: 932, dpr: 3 },
  { w: 1284, h: 2778, dw: 428, dh: 926, dpr: 3 },
  { w: 1125, h: 2436, dw: 375, dh: 812, dpr: 3 },
  { w: 828, h: 1792, dw: 414, dh: 896, dpr: 2 },
  { w: 750, h: 1334, dw: 375, dh: 667, dpr: 2 },
]

await mkdir(new URL('../public/splash', import.meta.url), { recursive: true })
for (const d of SPLASH_MATRIX) {
  const markW = Math.round(d.w * 0.4)
  const mark = await sharp(wordmarkPath).resize({ width: markW }).toBuffer()
  const { height: markH } = await sharp(mark).metadata()
  await sharp({ create: { width: d.w, height: d.h, channels: 4, background: LIME } })
    .composite([{ input: mark, left: Math.round((d.w - markW) / 2), top: Math.round((d.h - markH) / 2) }])
    .flatten({ background: LIME })
    .png()
    .toFile(out(`splash/splash-${d.w}x${d.h}.png`))
}
console.log('splash screens generated:', SPLASH_MATRIX.length)

// ---------- артефакт: maskable под круглой маской (визуальная проверка safe zone) ----------
{
  const size = 512
  const base = await (await icon(size, 0.64)).toBuffer()
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )
  const cropped = await sharp(base).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer()
  const scratch = process.env.SCRATCH_DIR
  if (scratch) {
    await writeFile(scratch + '/maskable-circle-test.png', cropped)
    console.log('maskable circle test →', scratch)
  }
}

console.log('icons generated')
