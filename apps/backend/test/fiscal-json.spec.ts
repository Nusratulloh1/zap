// Парсер JSON-ответа ОФД (new-ofd.soliq.uz/api/payment) против РЕАЛЬНЫХ чеков.
// Фикстуры записаны один раз (публичные чеки), тесты не ходят в soliq.uz.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FiscalService } from '../src/fiscal/fiscal.service'

const svc = new FiscalService(null as never, null as never)
const fx = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')

describe('FiscalService.parsePaymentJson (реальные чеки ОФД)', () => {
  it('чек 1: MURODOV UMID · Маргарин ×1 · 16 000', () => {
    const r = svc.parsePaymentJson(fx('ofd-payment-1.json'))
    expect(r.merchantName).toContain('MURODOV UMID')
    expect(r.totalAmount).toBe(16_000)
    expect(r.items).toHaveLength(1)
    expect(r.items[0]!.name).toBe('Маргарин')
    expect(r.items[0]!.qtyMilli).toBe(1000)
    expect(r.items[0]!.lineTotal).toBe(16_000)
    expect(r.merchantInn).toBe('30809900222317')
    expect(r.datetime?.getFullYear()).toBe(2026)
    expect(r.datetime?.getMonth()).toBe(7) // август (0-based)
  })

  it('чек 2: ALIMBAYEV · 9 позиций с дробными кг · тотал = карта+наличные', () => {
    const r = svc.parsePaymentJson(fx('ofd-payment-2.json'))
    expect(r.merchantName).toContain('ALIMBAYEV')
    expect(r.items).toHaveLength(9)
    // дробное количество: 1.268 кг → qtyMilli 1268
    const chicken = r.items.find((i) => i.name.includes('Bedro'))
    expect(chicken?.qtyMilli).toBe(1268)
    expect(r.totalAmount).toBe(167_284) // авторитетный тотал = cardTotal
    // `price` в JSON = стоимость строки → сумма позиций сходится с тоталом
    // (±округление дробных строк, ≤1 сум на позицию)
    const sum = r.items.reduce((s, i) => s + i.lineTotal, 0)
    expect(Math.abs(sum - r.totalAmount)).toBeLessThanOrEqual(r.items.length)
  })

  it('URL: узбекский QR даёт дату из c, но НЕ сумму (s = подпись, не тотал)', () => {
    process.env.OFD_HOSTS = 'ofd.soliq.uz'
    const ref = svc.tryParseFiscalUrl('https://ofd.soliq.uz/check?t=LG420211638943&r=6330&c=20260812111605&s=500597331143')
    expect(ref).toBeTruthy()
    expect(ref!.instant.totalAmount).toBeUndefined() // суммы в URL нет
    expect(ref!.instant.datetime).toBe('2026-08-12T11:16:05')
    expect(ref!.fiscalKey).toContain('ofd.soliq.uz')
  })
})
