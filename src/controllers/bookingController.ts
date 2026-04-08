import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const guestId = req.user?.userId;
    if (!guestId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { spotId, startTime, endTime } = req.body;
    
    const spot = await prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) {
      res.status(404).json({ error: 'Spot not found' });
      return;
    }

    // Calculate hours (simplified)
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    
    // Add platform fee
    const baseAmount = hours * spot.rate;
    const totalAmount = baseAmount + (baseAmount * 0.1);

    const booking = await prisma.booking.create({
      data: {
        spotId,
        guestId,
        startTime: start,
        endTime: end,
        totalAmount,
        status: 'CONFIRMED'
      }
    });

    // Create a transaction simulated record
    await prisma.transaction.create({
       data: {
          userId: guestId,
          amount: totalAmount,
          type: 'PAYMENT',
          status: 'COMPLETED'
       }
    });

    res.status(201).json(booking);
  } catch (error) {
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
