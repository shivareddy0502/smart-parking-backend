import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../utils/prisma';
import { sendPush } from '../../utils/push';
import crypto from 'crypto';

export const getBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { guestId: userId },
          { spot: { hostId: userId } }
        ]
      },
      include: {
        spot: true,
        digitalKey: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = bookings.map(b => ({
      id: b.id,
      spotId: b.spotId,
      spotTitle: b.spotTitle || b.spot.title,
      spotAddress: b.spotAddress || b.spot.location,
      driverId: b.guestId,
      driverName: b.driverName || 'Guest',
      ownerId: b.spot.hostId,
      startTime: b.startTime,
      endTime: b.endTime,
      totalPrice: b.totalAmount,
      pricingType: b.pricingType.toLowerCase(),
      status: b.status.toLowerCase(),
      digitalKey: b.digitalKey ? {
          id: b.digitalKey.id,
          bookingId: b.id,
          payload: b.digitalKey.payload,
          expiresAt: b.digitalKey.expiresAt,
          isUsed: b.digitalKey.isUsed,
          createdAt: b.digitalKey.createdAt
      } : undefined,
      vehicleType: b.vehicleType.replace('_', '-').toLowerCase(),
      createdAt: b.createdAt
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching bookings' });
  }
};

export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { 
      spotId, spotTitle, spotAddress, driverId, driverName, 
      ownerId, startTime, endTime, totalPrice, pricingType, vehicleType 
    } = req.body;

    const booking = await prisma.booking.create({
      data: {
        spotId,
        guestId: userId!,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        totalAmount: totalPrice,
        status: 'PENDING',
        pricingType: pricingType ? (pricingType.toUpperCase() as any) : 'HOURLY',
        vehicleType: vehicleType ? (vehicleType.toUpperCase().replace('-', '_') as any) : 'FOUR_WHEELER',
        spotTitle,
        spotAddress,
        driverName
      },
      include: { spot: true }
    });

    // Side effects
    await prisma.spot.update({
      where: { id: spotId },
      data: { totalBookings: { increment: 1 } }
    });

    await prisma.transaction.create({
      data: {
        userId: userId!,
        amount: totalPrice,
        type: 'PAYMENT',
        status: 'PENDING',
        bookingId: booking.id,
        spotTitle: spotTitle || booking.spot.title
      }
    });

    // Notify owner
    sendPush(
      ownerId,
      "New Booking Request",
      `${driverName || 'Someone'} wants to park at ${spotTitle || booking.spot.title}`,
      { bookingId: booking.id, screen: "bookings" }
    );

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error creating booking' });
  }
};

export const acceptBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { spot: true }
    });

    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }
    if (booking.spot.hostId !== userId) { res.status(403).json({ message: 'Not authorized' }); return; }

    const digitalKeyPayload = 'PSK-' + crypto.randomBytes(32).toString('hex');

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        digitalKey: {
          create: {
            payload: digitalKeyPayload,
            expiresAt: booking.endTime
          }
        }
      },
      include: { digitalKey: true, spot: true }
    });

    // Mark transaction as completed (assuming payout/earning logic)
    await prisma.transaction.updateMany({
        where: { bookingId: id, type: 'PAYMENT' },
        data: { status: 'COMPLETED' }
    });

    // Notify driver
    sendPush(
      booking.guestId,
      "Booking Confirmed!",
      `Your spot at ${booking.spotTitle || booking.spot.title} is confirmed. Digital key is ready.`,
      { bookingId: booking.id }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error accepting booking' });
  }
};

export const declineBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { spot: true }
    });

    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }
    if (booking.spot.hostId !== userId) { res.status(403).json({ message: 'Not authorized' }); return; }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { spot: true }
    });

    // Notify driver
    sendPush(
      booking.guestId,
      "Booking Declined",
      `Your request for ${booking.spotTitle || booking.spot.title} was not accepted.`,
      { screen: "bookings" }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error declining booking' });
  }
};

export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { spot: true }
    });

    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }
    if (booking.guestId !== userId) { res.status(403).json({ message: 'Not authorized' }); return; }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { spot: true }
    });

    // Notify owner
    sendPush(
      booking.spot.hostId,
      "Booking Cancelled",
      `${booking.driverName || 'The driver'} cancelled their booking for ${booking.spotTitle || booking.spot.title}.`,
      { screen: "bookings" }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error cancelling booking' });
  }
};

export const completeBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.booking.update({
      where: { id },
      data: { status: 'COMPLETED' }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error completing booking' });
  }
};

export const markKeyUsed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.digitalKey.update({
      where: { bookingId: id },
      data: { isUsed: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error marking key used' });
  }
};
