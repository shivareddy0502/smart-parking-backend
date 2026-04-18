import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(bookings.map(b => ({ id: b.id, status: b.status, guestId: b.guestId, createdAt: b.createdAt })), null, 2));
}
run();
