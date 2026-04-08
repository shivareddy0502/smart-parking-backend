import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getHostStats = async (req: AuthRequest, res: Response) => {
  try {
    const hostId = req.user?.userId;

    const spots = await prisma.spot.findMany({
      where: { hostId },
      include: {
        bookings: {
          where: { status: { in: ['CONFIRMED', 'COMPLETED'] as any } }
        }
      }
    });

    const activeListings = spots.length;
    let totalEarnings = 0;
    let upcomingBookings = 0;

    (spots as any).forEach((spot: any) => {
      spot.bookings.forEach((booking: any) => {
        totalEarnings += booking.totalAmount;
        if (booking.status === 'CONFIRMED') {
          upcomingBookings++;
        }
      });
    });
    
    // Generate a quick mock trend based on totalEarnings
    const revenueData = [];
    for(let i = 1; i <= 30; i+=5) {
      revenueData.push({ date: i.toString(), amount: (totalEarnings / 6) * (Math.random() + 0.5) });
    }

    res.json({
      totalEarnings,
      activeListings,
      upcomingBookings,
      revenueData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch host stats' });
  }
};

export const getHostTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const hostId = req.user?.userId;

    // We derive host transactions from bookings made on their spots
    const bookings = await prisma.booking.findMany({
      where: { 
        spot: { hostId },
        status: { in: ['CONFIRMED', 'COMPLETED'] as any } 
      },
      orderBy: { startTime: 'desc' }
    });
    
    const formatted = bookings.map(b => ({
      id: b.id,
      date: b.startTime.toISOString().split('T')[0],
      amount: b.totalAmount,
      type: 'Earning',
      status: 'Completed',
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};
