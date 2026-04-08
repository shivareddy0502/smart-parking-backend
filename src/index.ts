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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  allowedHeaders: ['Content-Type', 'X-User-Id', 'Authorization']
}));

// Stripe Webhook MUST be parsed as raw before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
