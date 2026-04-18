import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import spotRoutes from './routes/spots';
import bookingRoutes from './routes/bookings';
import deviceRoutes from './routes/devices';
import messageRoutes from './routes/messages';
import reviewRoutes from './routes/reviews';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import hostRoutes from './routes/host';
import notificationRoutes from './routes/notifications';
import mobileRoutes from './routes/mobile';
import supportRoutes from './routes/support';
import userRoutes from './routes/users';
import vehicleRoutes from './routes/vehicles';
import prisma from './utils/prisma';

dotenv.config();

// ── Auto-cancel expired PENDING bookings (every 60s) ──────────────────────────
const PAYMENT_WINDOW_MINUTES = 15;
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MINUTES * 60 * 1000);
    const expired = await (prisma.booking.findMany as any)({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      select: { id: true, guestId: true, spot: { select: { title: true } } }
    });
    if (!expired || expired.length === 0) return;
    await (prisma.booking.updateMany as any)({
      where: { id: { in: expired.map((b: any) => b.id) } },
      data: { status: 'CANCELLED' }
    });
    const notifications = expired.map((b: any) => ({
      userId: b.guestId,
      title: 'Booking Expired',
      message: `Your booking for ${b.spot?.title ?? 'a parking spot'} was cancelled because payment was not completed within ${PAYMENT_WINDOW_MINUTES} minutes.`
    }));
    await prisma.notification.createMany({ data: notifications });
    console.log(`Auto-cancelled ${expired.length} expired PENDING booking(s).`);
  } catch (err) {
    console.error('Auto-cancel job error:', err);
  }
}, 60_000);
// ─────────────────────────────────────────────────────────────────────────────


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  allowedHeaders: ['Content-Type', 'X-User-Id', 'Authorization']
}));

// Stripe Webhook MUST be parsed as raw before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Parking API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/spots', spotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
