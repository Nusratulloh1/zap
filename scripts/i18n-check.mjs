// Паритет ключей локалей: все три файла обязаны иметь ОДИНАКОВЫЙ набор ключей.
// Запускается перед сборкой — расхождение валит билд, а не всплывает на проде.
// Дополнительно ловим пустые значения и несовпадение числа плюральных форм
// с правилом языка (ru — 3, uz/en — 1/2).
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'locales')
const BASE = 'ru' // эталон: с него начинали, он полнее всех по формулировкам

/** «home.searchPlaceholder» → плоский список путей до листьев */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out)
    else out.set(path, v)
  }
  return out
}

// только языковые файлы: в папке пакета лежит ещё package.json
const KNOWN = ['uz', 'ru', 'en']
const files = readdirSync(DIR).filter((f) => KNOWN.includes(f.replace(/\.json$/, '')))
const locales = new Map()
for (const f of files) {
  const name = f.replace(/\.json$/, '')
  locales.set(name, flatten(JSON.parse(readFileSync(join(DIR, f), 'utf8'))))
}

if (!locales.has(BASE)) {
  console.error(`i18n: нет эталонной локали ${BASE}.json`)
  process.exit(1)
}

const errors = []
const baseKeys = locales.get(BASE)

for (const [name, keys] of locales) {
  if (name !== BASE) {
    for (const k of baseKeys.keys()) if (!keys.has(k)) errors.push(`${name}: нет ключа «${k}» (есть в ${BASE})`)
    for (const k of keys.keys()) if (!baseKeys.has(k)) errors.push(`${name}: лишний ключ «${k}» (нет в ${BASE})`)
  }
  for (const [k, v] of keys) {
    if (typeof v !== 'string') errors.push(`${name}: «${k}» не строка`)
    else if (!v.trim()) errors.push(`${name}: «${k}» пустая строка`)
  }
}

// плюрализация: в ru у форм с «|» должно быть 3 варианта, в uz/en — 1 или 2
const PLURAL_FORMS = { ru: [3], uz: [1, 2], en: [1, 2] }
for (const [name, keys] of locales) {
  const allowed = PLURAL_FORMS[name]
  if (!allowed) continue
  for (const [k, v] of keys) {
    if (typeof v !== 'string' || !v.includes('|')) continue
    const n = v.split('|').length
    if (!allowed.includes(n)) {
      errors.push(`${name}: «${k}» — ${n} плюральных форм, ожидается ${allowed.join(' или ')}`)
    }
  }
}

if (errors.length) {
  console.error(`\ni18n: найдено расхождений — ${errors.length}\n`)
  for (const e of errors.slice(0, 60)) console.error('  ✗ ' + e)
  if (errors.length > 60) console.error(`  … и ещё ${errors.length - 60}`)
  console.error('')
  process.exit(1)
}

console.log(`i18n: ok — ${locales.size} локали, ${baseKeys.size} ключей, наборы совпадают`)
