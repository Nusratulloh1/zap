// ЛОКАЛЬНЫЙ сид: демо-мерчант Bellissimo (+счёт #481) и 3 демо-пользователя
// с известными номерами/PIN — мультипользовательские флоу тестируются сразу.
// Защита: работает ТОЛЬКО с localhost-базой.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL ?? ''
const host = url.match(/@([^:/]+)[:/]/)?.[1] ?? ''
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`db:seed:demo отклонён: DATABASE_URL указывает на "${host}", а не на localhost`)
  process.exit(1)
}

const prisma = new PrismaClient()
const DEMO_USERS = [
  { phone: '998900000001', name: 'Ислам' },
  { phone: '998900000002', name: 'Али' },
  { phone: '998900000003', name: 'Бек' },
]

try {
  const merchant = await prisma.merchant.upsert({
    where: { id: 'm_bellissimo' },
    create: {
      id: 'm_bellissimo',
      name: 'Bellissimo Pizza',
      letter: 'B',
      color: '#E2231A',
      cashbackRate: 25,
      cashbackX2: true,
      cashbackConditions: { minMembers: 2 },
    },
    update: {},
  })
  const bill = await prisma.bill.findFirst({ where: { merchantId: merchant.id, externalRef: '481' } })
  if (!bill) {
    await prisma.bill.create({
      data: {
        merchantId: merchant.id,
        externalRef: '481',
        tableRef: '12',
        totalAmount: 1_200_000,
        qrPayload: 'zap:bill:m_bellissimo:481:demo',
        items: {
          create: [
            { title: 'Пицца Пепперони ×2', qty: 2, amount: 380_000 },
            { title: 'Паста Карбонара', qty: 1, amount: 320_000 },
            { title: 'Лимонад ×4', qty: 4, amount: 200_000 },
            { title: 'Тирамису ×3', qty: 3, amount: 300_000 },
          ],
        },
      },
    })
  }

  const pinHash = await bcrypt.hash('1111', 10)
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { phone: u.phone },
      create: { phone: u.phone, name: u.name, pinHash },
      update: { name: u.name, pinHash },
    })
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, visits: 1 },
      update: {},
    })
  }

  console.log('seed-dev готов:')
  console.log('  мерчант Bellissimo Pizza + счёт #481 (1 200 000 UZS, QR: zap:bill:m_bellissimo:481:demo)')
  console.log('  фискальный демо-QR (нужен pnpm dev:fiscal-fixture):')
  console.log('  http://localhost:3299/check?t=EP000000000001&r=481&s=120000000&fs=DEMO000000000001&d=202608261942')
  for (const u of DEMO_USERS) console.log(`  ${u.phone} · ${u.name} · PIN 1111`)
} finally {
  await prisma.$disconnect()
}
