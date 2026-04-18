import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import Razorpay from 'razorpay';
import { logAction } from '../utils/auditLogger';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});


export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const guestId = req.user?.userId;
    const guestEmail = (req as any).user?.email || 'unknown@system';
    if (!guestId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { spotId, startTime, endTime } = req.body;
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 1. Check for overlapping bookings
    const existingClash = await prisma.booking.findFirst({
      where: {
        spotId,
        status: { in: ['CONFIRMED', 'ACTIVE'] as any },
        OR: [
          {
            AND: [
              { startTime: { lte: start } },
              { endTime: { gt: start } }
            ]
          },
          {
            AND: [
              { startTime: { lt: end } },
              { endTime: { gte: end } }
            ]
          },
          {
            AND: [
              { startTime: { gte: start } },
              { endTime: { lte: end } }
            ]
          }
        ]
      }
    });

    if (existingClash) {
      res.status(409).json({ error: 'SPOT_OCCUPIED', message: 'Spot occupied' });
      return;
    }
    
    const spot = await prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) {
      res.status(404).json({ error: 'Spot not found' });
      return;
    }

    const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    const baseAmount = hours * spot.rate;
    const totalAmount = baseAmount + (baseAmount * 0.1);

    const booking = await prisma.booking.create({
      data: {
        spotId,
        guestId,
        startTime: start,
        endTime: end,
        totalAmount,
        status: 'CONFIRMED' as any
      }
    });

    await (prisma.transaction.create as any)({
       data: {
          userId: guestId,
          amount: totalAmount,
          type: 'PAYMENT' as any,
          status: 'COMPLETED' as any,
          bookingId: booking.id,
          spotTitle: spot.title
       }
    });

    await (prisma.transaction.create as any)({
       data: {
          userId: spot.hostId,
          amount: totalAmount * 0.9,
          type: 'EARNING' as any,
          status: 'PENDING' as any,
          bookingId: booking.id,
          spotTitle: spot.title
       }
    });

    // PLATFORM LOG
    await logAction(guestId, guestEmail, 'CREATE_BOOKING', 'Booking', booking.id, { spotTitle: spot.title, amount: totalAmount });

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Server error creating booking' });
  }
};

export const getGuestBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const guestId = req.user?.userId;
    if (!guestId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const bookings = await prisma.booking.findMany({
      where: { guestId },
      include: {
        spot: true
      },
      orderBy: { startTime: 'desc' }
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching bookings' });
  }
};

export const getBookingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
      include: { spot: true, guest: { select: { id: true, name: true, email: true } } }
    }) as any;

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const isOwner = booking.guestId === userId || (booking.spot && booking.spot.hostId === userId);
    if (!isOwner) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching booking' });
  }
};

export const getHostBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const bookings = await prisma.booking.findMany({
      where: {
        spot: {
          hostId: hostId
        }
      },
      include: {
        spot: true,
        guest: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    res.json(bookings);
  } catch (error) {
    console.error('Fetch host bookings error:', error);
    res.status(500).json({ error: 'Server error fetching bookings' });
  }
};
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userEmail = (req as any).user?.email || 'unknown@system';
    const { id } = req.params;
    const { reason } = req.body;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid booking ID' });
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        spot: true,
        guest: true
      }
    }) as any;

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const isGuest = booking.guestId === userId;
    const isHost = booking.spot.hostId === userId;

    if (!isGuest && !isHost) {
      res.status(403).json({ error: 'Unauthorized to cancel this booking' });
      return;
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      res.status(400).json({ error: 'Booking cannot be cancelled in current status' });
      return;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' as any }
    });

    const bookingAny = booking as any;
    if (bookingAny.razorpayPaymentId) {
      try {
        await razorpay.payments.refund(bookingAny.razorpayPaymentId, {
          amount: Math.round(booking.totalAmount * 100), // amount in paise
          speed: 'normal',
          notes: { reason: reason || 'Booking cancelled by user', bookingId: booking.id }
        } as any);
      } catch (refundError) {
        console.error('Razorpay refund failed:', refundError);
      }
    }

    await (prisma.transaction.create as any)({
      data: {
        userId: booking.guestId,
        bookingId: booking.id,
        amount: booking.totalAmount,
        type: 'REFUND' as any,
        status: 'COMPLETED' as any,
        spotTitle: booking.spot.title
      }
    });

    await (prisma.transaction.create as any)({
      data: {
        userId: booking.spot.hostId,
        bookingId: booking.id,
        amount: booking.totalAmount * 0.9,
        type: 'REFUND' as any,
        status: 'COMPLETED' as any,
        spotTitle: booking.spot.title
      }
    });

    // PLATFORM LOG
    await logAction(userId as string, userEmail, 'CANCEL_BOOKING', 'Booking', booking.id, { reason });

    const notificationTarget = isGuest ? booking.spot.hostId : booking.guestId;
    const cancelerType = isGuest ? 'Guest' : 'Host';
    const reasonText = reason ? ` Reason: "${reason}"` : '';
    
    await prisma.notification.create({
      data: {
        userId: notificationTarget,
        title: 'Booking Cancelled',
        message: `Your booking for ${booking.spot.title} has been cancelled by the ${cancelerType}.${reasonText}`
      }
    });

    res.json(updatedBooking);
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Server error cancelling booking' });
  }
};
