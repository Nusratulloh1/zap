// Пиксель-дифф двух каталогов скриншотов (pixelmatch).
// node scripts/theme-diff.mjs <baseDir> <testDir> [diffDir]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const [base, test, diffDir] = process.argv.slice(2)
if (!base || !test) {
  console.error('usage: node scripts/theme-diff.mjs <baseDir> <testDir> [diffDir]')
  process.exit(2)
}
if (diffDir) mkdirSync(diffDir, { recursive: true })

let failCount = 0
const rows = []
for (const name of readdirSync(base).filter((f) => f.endsWith('.png')).sort()) {
  const a = PNG.sync.read(readFileSync(base + '/' + name))
  let b
  try {
    b = PNG.sync.read(readFileSync(test + '/' + name))
  } catch {
    rows.push([name, 'MISSING'])
    failCount++
    continue
  }
  if (a.width !== b.width || a.height !== b.height) {
    rows.push([name, `SIZE ${a.width}x${a.height} vs ${b.width}x${b.height}`])
    failCount++
    continue
  }
  const out = diffDir ? new PNG({ width: a.width, height: a.height }) : undefined
  const bad = pixelmatch(a.data, b.data, out?.data, a.width, a.height, { threshold: 0.08 })
  const pct = (bad / (a.width * a.height)) * 100
  const ok = pct <= 0.1
  if (!ok) {
    failCount++
    if (out && diffDir) writeFileSync(diffDir + '/' + name, PNG.sync.write(out))
  }
  rows.push([name, pct.toFixed(3) + '%' + (ok ? '' : '  << DIFF')])
}
for (const [n, r] of rows) console.log(n.padEnd(30), r)
console.log(failCount === 0 ? '\nALL IDENTICAL (<=0.1%)' : `\n${failCount} screen(s) differ`)
process.exit(failCount === 0 ? 0 : 1)
