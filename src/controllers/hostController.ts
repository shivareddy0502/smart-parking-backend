import { Request, Response } from 'express';
import { PrismaClient, TransactionType } from '@prisma/client';
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
    let pendingEarnings = 0;

    (spots as any).forEach((spot: any) => {
      spot.bookings.forEach((booking: any) => {
        if (booking.status === 'COMPLETED') {
          totalEarnings += booking.totalAmount;
        } else if (booking.status === 'CONFIRMED' || booking.status === 'ACTIVE') {
          pendingEarnings += booking.totalAmount;
          upcomingBookings++;
        }
      });
    });
    
    // Calculate balances
    const platformFeeRate = 0.1;
    const totalNetEarnings = totalEarnings * (1 - platformFeeRate);
    
    // Deduct successful OR pending payouts from "available" view to avoid double-withdrawal
    const payouts = await prisma.transaction.aggregate({
      where: { userId: hostId, type: 'PAYOUT' as any, status: { in: ['COMPLETED', 'PENDING'] as any } },
      _sum: { amount: true }
    });
    const totalWithdrawn = Math.abs((payouts._sum as any)?.amount || 0);

    const availableBalance = Math.max(0, totalNetEarnings - totalWithdrawn);
    const arrivingSoon = pendingEarnings * (1 - platformFeeRate);
    const nextPayout = availableBalance > 100 ? availableBalance : 0; 

    // Generate a quick mock trend based on totalEarnings
    const revenueData = [];
    for(let i = 1; i <= 30; i+=5) {
      revenueData.push({ date: i.toString(), amount: (totalEarnings / 6) * (Math.random() + 0.5) });
    }

    res.json({
      totalEarnings,
      availableBalance,
      pendingEarnings: arrivingSoon,
      nextPayout,
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
    const userId = req.user?.userId;

    // 1. Get explicit transactions
    const txs = await prisma.transaction.findMany({
      where: { userId },
      include: { booking: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // 2. Get bookings that might not have transactions yet (for the "Arriving Soon" stats)
    const bookings = await prisma.booking.findMany({
      where: {
        spot: { hostId: userId },
        status: { in: ['CONFIRMED', 'ACTIVE'] as any }
      },
      include: { spot: true }
    });

    const formattedTxs = txs
      .filter((tx: any) => {
        // If it's a refund and the user is the guest, hide it from the wallet list
        // as per developer instructions (should only show against booking)
        if (tx.type === 'REFUND' && tx.booking?.guestId === userId) {
          return false;
        }
        return true;
      })
      .map((tx: any) => ({
        id: tx.id,
        date: tx.createdAt.toISOString().split('T')[0],
        time: tx.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: tx.amount,
        type: tx.type === 'REFUND' ? 'Refund' : (tx.type === 'EARNING' ? 'Earning' : 'Payment'),
        status: tx.status === 'COMPLETED' ? 'Completed' : 'Pending',
        bookingId: tx.bookingId
      }));

    // Identify booking IDs already in transactions to avoid duplicates
    const existingBookingIds = new Set(txs.map((tx: any) => tx.bookingId).filter(id => !!id));

    const derivedTxs = bookings
      .filter(b => !existingBookingIds.has(b.id))
      .map((b: any) => ({
        id: `derived-${b.id}`,
        date: b.createdAt.toISOString().split('T')[0],
        time: b.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: b.totalAmount * 0.9,
        type: 'Earning',
        status: 'Pending',
        bookingId: b.id
      }));

    // Combine and sort
    const allTxs = [...formattedTxs, ...derivedTxs].sort((a, b) => {
      return new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime();
    });
    
    res.json(allTxs);
  } catch (error) {
    console.error('Fetch host transactions error:', error);
    res.status(500).json({ error: 'Failed' });
  }
};
export const exportHostStatement = async (req: AuthRequest, res: Response) => {
  try {
    const hostId = req.user?.userId;

    const bookings = await prisma.booking.findMany({
      where: { 
        spot: { hostId },
        status: { in: ['CONFIRMED', 'COMPLETED'] as any } 
      },
      include: {
        spot: true,
      },
      orderBy: { startTime: 'desc' }
    });

    // Create CSV content
    const headers = ['Date', 'Booking ID', 'Spot Name', 'Status', 'Total Amount', 'Platform Fee (10%)', 'Net Amount'];
    const rows = bookings.map(b => {
      const platformFee = b.totalAmount * 0.1;
      return [
        b.startTime.toISOString().split('T')[0],
        b.id,
        b.spot.title,
        b.status,
        b.totalAmount.toFixed(2),
        platformFee.toFixed(2),
        (b.totalAmount - platformFee).toFixed(2)
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=SmartPark_Statement_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to export statement' });
  }
};

export const requestPayout = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { amount, method } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Double check balance server-side
    const spots = await prisma.spot.findMany({
      where: { hostId: userId },
      include: {
        bookings: {
          where: { status: 'COMPLETED' }
        }
      }
    });

    let totalEarnings = 0;
    (spots as any).forEach((spot: any) => {
      spot.bookings.forEach((booking: any) => {
        totalEarnings += booking.totalAmount;
      });
    });

    const netEarnings = totalEarnings * 0.9;
    
    const payouts = await prisma.transaction.aggregate({
      where: { userId, type: 'PAYOUT' as any, status: { in: ['COMPLETED', 'PENDING'] as any } },
      _sum: { amount: true }
    });
    const totalWithdrawn = Math.abs((payouts._sum as any)?.amount || 0);
    const availableBalance = netEarnings - totalWithdrawn;

    if (amount > availableBalance) {
      return res.status(400).json({ error: 'Insufficient funds for this payout' });
    }

    // Create the Payout transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: userId!,
        amount: -amount, // Payout is a deduction
        type: 'PAYOUT' as any,
        status: 'PENDING',
        spotTitle: `Payout to ${method || 'Default Bank'}`
      }
    });

    // Generate notification
    await prisma.notification.create({
      data: {
        userId: userId!,
        title: 'Payout Requested',
        message: `Your request for $${amount} has been received and is being processed.`
      }
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ error: 'Failed' });
  }
};
