// Юнит-тест математики чипов участника (3 человека) + совпадение с серверным клампом.
import { participantChips, clampCharge, round1000 } from '../src/splits/participant-chips'

describe('participantChips — кейс на 3 человек', () => {
  // сплит 300 000 на троих (equal) → по 100 000; организатор уже оплатил свою долю
  const total = 300_000
  const share = 100_000
  const paidTotal = 100_000 // оплатил только создатель

  it('выводит чипы строго из доли участника', () => {
    const c = participantChips({ share, total, paidTotal })
    expect(c.myShare).toBe(100_000)
    expect(c.half).toBe(50_000) // round1000(share/2)
    expect(c.remaining).toBe(200_000) // total - paidTotal
    expect(c.double).toBe(200_000) // min(share*2, remaining) — ровно за двоих
    expect(c.quick).toEqual([]) // 100000/250000 не < доли(100000)
  })

  it('«половина» округляется до 1000 при нечётной доле', () => {
    expect(participantChips({ share: 33_000, total, paidTotal }).half).toBe(round1000(16_500)) // 17 000
    expect(participantChips({ share: 45_000, total, paidTotal }).half).toBe(23_000) // 22 500 → 23 000
  })

  it('быстрые суммы показываются только если МЕНЬШЕ доли', () => {
    // доля 300 000 → 100 000 и 250 000 обе меньше → обе доступны
    expect(participantChips({ share: 300_000, total: 900_000, paidTotal: 0 }).quick).toEqual([100_000, 250_000])
    // доля 120 000 → только 100 000 < доли
    expect(participantChips({ share: 120_000, total, paidTotal }).quick).toEqual([100_000])
  })

  it('«за двоих» зажимается остатком, и это совпадает с серверным клампом', () => {
    // остаток меньше, чем share*2: кто-то уже частично оплатил (paidTotal=150000)
    const c = participantChips({ share, total, paidTotal: 150_000 })
    expect(c.remaining).toBe(150_000)
    expect(c.double).toBe(150_000) // min(200000, 150000)
    // сервер при попытке заплатить double спишет ровно столько же
    const serverCharged = clampCharge(c.double, total, 150_000)
    expect(serverCharged).toBe(c.double)
    // и даже если участник как-то отправит больше остатка — сервер зажмёт к остатку
    expect(clampCharge(999_000, total, 150_000)).toBe(150_000)
  })

  it('оплата ровно «за двоих» закрывает остаток (сумма == total)', () => {
    const c = participantChips({ share, total, paidTotal })
    const serverCharged = clampCharge(c.double, total, paidTotal)
    expect(paidTotal + serverCharged).toBe(total) // 100000 + 200000 = 300000 → сплит закрыт
  })
})
