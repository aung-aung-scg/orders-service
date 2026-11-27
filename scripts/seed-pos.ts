import { randomBytes } from 'node:crypto'
import { createDb } from '../src/lib/db.js'
import { seedDefaultRestaurant } from '../src/lib/booking.js'

const menu: [string, number][] = [
  ['Pad Thai', 8500], ['Green Curry', 11000], ['Fried Rice', 7500],
  ['Tom Yum', 12000], ['Papaya Salad', 6500], ['Spring Rolls', 6000],
  ['Grilled Chicken', 9500], ['Mango Sticky Rice', 8000],
  ['Thai Iced Tea', 4500], ['Water', 2000],
]
const db = createDb()
try {
  const { id: restaurantId } = await seedDefaultRestaurant(db)
  await db.$transaction([
    ...Array.from({ length: 5 }, (_, index) => db.diningTable.upsert({
      where: { restaurantId_number: { restaurantId, number: index + 1 } },
      create: { restaurantId, number: index + 1, capacity: [2, 2, 4, 4, 6][index], qrToken: randomBytes(24).toString('base64url') },
      update: { capacity: [2, 2, 4, 4, 6][index] },
    })),
    ...menu.map(([name, priceMinor], index) => db.menuItem.upsert({
      where: { id: `pos-seed-${index + 1}`, restaurantId },
      create: { id: `pos-seed-${index + 1}`, restaurantId, name, priceMinor },
      update: {},
    })),
  ])
} finally {
  await db.$disconnect()
}
