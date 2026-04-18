import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import Razorpay from 'razorpay';

const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// Initiates a real Razorpay payment order
export const initiateUPIPayment = async (req: Request, res: Response) => {
  try {
    const guestId = (req as any).user?.userId;
    if (!guestId) {
       return res.status(401).json({ error: 'Unauthorized' });
    }

    const { spotId, startTime, endTime } = req.body;
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 1. Check for overlapping CONFIRMED/ACTIVE bookings only
    // PENDING bookings do NOT block the slot — they may be abandoned Razorpay sessions
    const existingClash = await prisma.booking.findFirst({
      where: {
        spotId,
        status: { in: ['CONFIRMED', 'ACTIVE'] as any[] },
        OR: [
          { AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }] },
          { AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }] },
          { AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }] }
        ]
      }
    });

    if (existingClash) {
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(start);
      dayEnd.setHours(23, 59, 59, 999);

      const dayBookings = await prisma.booking.findMany({
        where: {
          spotId,
          status: { in: ['CONFIRMED', 'ACTIVE'] as any[] },
          startTime: { gte: dayStart },
          endTime: { lte: dayEnd }
        },
        orderBy: { startTime: 'asc' }
      });

      const freeSlots = [];
      let lastEnd = dayStart;

      for (const b of dayBookings) {
        if (b.startTime.getTime() - lastEnd.getTime() >= 3600000) { 
          freeSlots.push({
            start: lastEnd.toISOString(),
            end: b.startTime.toISOString(),
            label: `${lastEnd.getHours().toString().padStart(2, '0')}:00 - ${b.startTime.getHours().toString().padStart(2, '0')}:00`
          });
        }
        lastEnd = b.endTime > lastEnd ? b.endTime : lastEnd;
      }

      if (dayEnd.getTime() - lastEnd.getTime() >= 3600000) {
        freeSlots.push({
          start: lastEnd.toISOString(),
          end: dayEnd.toISOString(),
          label: `${lastEnd.getHours().toString().padStart(2, '0')}:00 - 23:59`
        });
      }

      return res.status(409).json({ 
        error: 'SPOT_OCCUPIED', 
        message: 'This spot is already booked for the selected time.',
        availableSlots: freeSlots
      });
    }
    
    // 2. Fetch spot to get rate
    const spot = await prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found' });
    }
    
    // 3. Calculate duration and total (Minimum 1 hour charge)
    const msDiff = end.getTime() - start.getTime();
    const hours = Math.max(1, Math.ceil(msDiff / 3600000));
    const totalAmount = (spot.rate * hours) + (spot.rate * hours * 0.1); // Add 10% platform fee

    // 4. Create Razorpay Order
    const options = {
      amount: Math.round(totalAmount * 100), // amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // 5. Create PENDING booking in database linked to the Razorpay Order
    const booking = await prisma.booking.create({
      data: {
        spotId,
        guestId,
        startTime: start,
        endTime: end,
        totalAmount,
        status: 'PENDING',
        razorpayOrderId: order.id,
        vehicleType: (spot as any).capacity || 'FOUR_WHEELER',
      } as any
    });


    res.json({ 
      id: booking.id, 
      razorpayOrderId: order.id,
      amount: totalAmount,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error initiating Razorpay payment:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
};

// Verifies a real Razorpay payment using signature
export const verifyUPIPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const booking = await prisma.booking.findUnique({ 
        where: { id: bookingId },
        include: { spot: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Final clash re-check: ensure no one else got CONFIRMED for this slot in the meantime
    const finalClash = await prisma.booking.findFirst({
      where: {
        spotId: booking.spotId,
        status: { in: ['CONFIRMED', 'ACTIVE'] as any[] },
        id: { not: bookingId },
        OR: [
          { AND: [{ startTime: { lte: booking.startTime } }, { endTime: { gt: booking.startTime } }] },
          { AND: [{ startTime: { lt: booking.endTime } }, { endTime: { gte: booking.endTime } }] },
          { AND: [{ startTime: { gte: booking.startTime } }, { endTime: { lte: booking.endTime } }] }
        ]
      }
    });
    if (finalClash) {
      // Cancel this pending booking since the slot is now taken
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' as any } });
      return res.status(409).json({ error: 'This slot was booked by someone else. Your payment will be refunded.' });
    }

    // Update booking status
    await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'CONFIRMED',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      } as any
    });

    // Create a successful Transaction record
    await (prisma.transaction.create as any)({
        data: {
          amount: booking.totalAmount,
          type: 'PAYMENT',
          status: 'COMPLETED',
          userId: booking.guestId,
          bookingId: booking.id,
          spotTitle: (booking.spot as any)?.title || 'Parking Booking'
        }
    });

    // Create notifications for Guest and Host
    await prisma.notification.createMany({
      data: [
        {
          userId: booking.guestId,
          title: 'Booking Confirmed!',
          message: `Your reservation for ${booking.spot.title} is confirmed.`
        },
        {
          userId: booking.spot.hostId,
          title: 'New Booking Received',
          message: `You have a new booking for ${booking.spot.title} starting ${booking.startTime.toLocaleString()}.`
        }
      ]
    });

    return res.status(200).json({ success: true, status: 'CONFIRMED' });
  } catch (error) {
    console.error("Razorpay Verification error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Returns existing order details for a PENDING booking so the guest can retry payment
export const resumePayment = async (req: Request, res: Response) => {
  try {
    const guestId = (req as any).user?.userId;
    const bookingId = req.params.bookingId as string;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { spot: true }
    }) as any;

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.guestId !== guestId) return res.status(403).json({ error: 'Forbidden' });
    if (booking.status !== 'PENDING') return res.status(400).json({ error: 'Booking is not pending payment' });
    if (!booking.razorpayOrderId) return res.status(400).json({ error: 'No payment order found for this booking' });

    return res.json({
      id: booking.id,
      razorpayOrderId: booking.razorpayOrderId,
      amount: booking.totalAmount,
      key: process.env.RAZORPAY_KEY_ID,
      spotTitle: booking.spot?.title || 'Parking Spot',
      createdAt: booking.createdAt
    });
  } catch (error) {
    console.error('Resume payment error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

