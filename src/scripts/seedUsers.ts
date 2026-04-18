import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createUser(email: string, role: any, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password', salt);

  return await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
    },
  });
}

async function main() {
  const host = await createUser('host@example.com', 'HOST', 'Elite Valet Services');
  const guest = await createUser('guest@example.com', 'GUEST', 'John Driver');
  const admin = await createUser('admin@example.com', 'ADMIN', 'Global Overseer');

  // Create some Spots
  const spot1 = await prisma.spot.create({
      data: {
          title: 'Premium Downtown Bay',
          location: '123 Main St, New York',
          rate: 15.0,
          hostId: host.id,
          capacity: 'FOUR_WHEELER',
          latitude: 40.7128,
          longitude: -74.0060,
          features: ['CCTV', 'Covered'],
      }
  });

  const spot2 = await prisma.spot.create({
    data: {
        title: 'Airport Long-Term X',
        location: 'JFK Terminal 4',
        rate: 8.0,
        hostId: host.id,
        capacity: 'SIX_WHEELER',
        latitude: 40.6413,
        longitude: -73.7781,
    }
  });

  // Create IoT Devices
  await prisma.device.createMany({
      data: [
          { macAddress: 'ESP32-94:E6:86:12', status: 'ONLINE', spotId: spot1.id, lastHeartbeat: new Date() },
          { macAddress: 'ESP32-A1:C2:55:FF', status: 'OFFLINE', spotId: spot2.id, lastHeartbeat: new Date(Date.now() - 3600000) },
          { macAddress: 'ESP32-B2:D3:66:00', status: 'ONLINE', spotId: spot1.id, lastHeartbeat: new Date(Date.now() - 600000) },
      ]
  });

  // Create some Bookings and Transactions
  const booking1 = await prisma.booking.create({
      data: {
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          totalAmount: 45.0,
          status: 'COMPLETED',
          guestId: guest.id,
          spotId: spot1.id,
          paymentRef: 'PAY-123456789'
      }
  });

  await prisma.transaction.create({
      data: {
          amount: 45.0,
          type: 'PAYMENT',
          userId: guest.id,
          bookingId: booking1.id,
          status: 'COMPLETED'
      }
  });

  console.log('Advanced seed completed perfectly.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
