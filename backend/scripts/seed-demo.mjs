// Демо-сид (Bellissimo + счёт #481) для показов. НИКОГДА не в проде:
// требует ALLOW_DEMO_SEED=true, иначе выходит без изменений.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    console.log('seed:demo пропущен — ALLOW_DEMO_SEED != true (прод-защита)')
    process.exit(0)
  }
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
  const existing = await prisma.bill.findFirst({ where: { merchantId: merchant.id, externalRef: '481' } })
  if (!existing) {
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
  console.log('seed:demo готов — Bellissimo Pizza + счёт #481 (1 200 000 UZS)')
} finally {
  await prisma.$disconnect()
}
