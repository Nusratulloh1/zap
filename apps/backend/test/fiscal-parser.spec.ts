// Юнит-тесты парсера страниц ОФД против закоммиченных фикстур.
// Живой фейл → снапшот в var/fiscal-snapshots → новая фикстура сюда.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FiscalService } from '../src/fiscal/fiscal.service'

const svc = new FiscalService(null as never, null as never)
const fx = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')

describe('FiscalService.parseCheckPage', () => {
  it('русскоязычный чек: 4 позиции, итог, мерчант, ИНН, дата', () => {
    const r = svc.parseCheckPage(fx('ofd-check-1.html'))
    expect(r.items).toHaveLength(4)
    expect(r.items.map((i) => i.lineTotal)).toEqual([380_000, 320_000, 200_000, 300_000])
    expect(r.items[0]!.qtyMilli).toBe(2000)
    expect(r.totalAmount).toBe(1_200_000)
    expect(r.merchantInn).toBe('123456789')
    expect(r.merchantName).toContain('DEMO SAVDO')
    expect(r.datetime?.getFullYear()).toBe(2026)
    const sum = r.items.reduce((s, i) => s + i.lineTotal, 0)
    expect(Math.abs(sum - r.totalAmount)).toBeLessThanOrEqual(1000)
  })

  it('узбекский чек: дробные количества (0.500 кг), Jami-итог', () => {
    const r = svc.parseCheckPage(fx('ofd-check-2.html'))
    expect(r.items).toHaveLength(4)
    const meat = r.items.find((i) => i.name.includes("Go'sht"))
    expect(meat?.qtyMilli).toBe(500)
    expect(meat?.lineTotal).toBe(60_000)
    const rice = r.items.find((i) => i.name.includes('Guruch'))
    expect(rice?.qtyMilli).toBe(1250)
    expect(r.totalAmount).toBe(112_000)
    expect(r.merchantInn).toBe('987654321')
  })

  it('пустая/чужая страница: позиций нет — валидация уронит джобу, не приложение', () => {
    const r = svc.parseCheckPage('<html><body><h1>404 Not Found</h1></body></html>')
    expect(r.items).toHaveLength(0)
  })

  it('распознавание фискального URL: датавремя из параметров, БЕЗ суммы', () => {
    process.env.OFD_HOSTS = 'ofd.soliq.uz'
    const ref = svc.tryParseFiscalUrl('https://ofd.soliq.uz/check?t=EP000000000001&r=1234&d=202608261942&s=000000000001')
    expect(ref).toBeTruthy()
    expect(ref!.instant.totalAmount).toBeUndefined() // сумму QR не несёт
    expect(ref!.instant.datetime).toContain('2026-08-26T19:42')
    expect(ref!.fiscalKey).toContain('ofd.soliq.uz')
    // не-вайтлист хост — не фискальный
    expect(svc.tryParseFiscalUrl('https://evil.example.com/check?s=1')).toBeNull()
  })

  it('реальный чек: `s` — фискальный признак (подпись), НЕ сумма; дата из c', () => {
    process.env.OFD_HOSTS = 'ofd.soliq.uz'
    const ref = svc.tryParseFiscalUrl('https://ofd.soliq.uz/check?t=UZ201125109247&r=10522&c=20260408125518&s=801529402014')
    expect(ref).toBeTruthy()
    expect(ref!.instant.totalAmount).toBeUndefined()
    expect(ref!.instant.datetime).toBe('2026-04-08T12:55:18')
    expect(ref!.fiscalKey).toContain('ofd.soliq.uz')
  })
})
