// Плоское превью Main.dc.html для визуальной проверки: та же вёрстка, но без
// обёртки Design Components — можно открыть в браузере и снять скриншот.
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(new URL('./Main.dc.html', import.meta.url), 'utf8')
const helmet = src.split('<helmet>')[1].split('</helmet>')[0]
const body = src.split('</helmet>')[1].split('</x-dc>')[0]

writeFileSync(
  new URL('./preview.html', import.meta.url),
  `<!doctype html>\n<html><head><meta charset="utf-8"><base href="img/">${helmet}</head><body>${body}</body></html>\n`,
)
console.log('preview.html written')
