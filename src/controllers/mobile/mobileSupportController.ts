import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../utils/prisma';

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { bookingId, type, message, images } = req.body;

    const ticket = await (prisma as any).supportTicket.create({
      data: {
        guestId: userId!,
        reservationId: bookingId,
        type: type || 'GENERAL',
        description: message,
        imageUrl: images && images.length > 0 ? images[0] : null,
        status: 'OPEN'
      }
    });

    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create support ticket' });
  }
};

export const getMyTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tickets = await (prisma as any).supportTicket.findMany({
      where: {
        OR: [
          { guestId: userId },
          { booking: { spot: { hostId: userId } } }
        ]
      },
      include: {
        booking: { include: { spot: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tickets.map((t: any) => ({
        id: t.id,
        bookingId: t.reservationId,
        spotTitle: t.booking?.spot?.title || 'System',
        type: t.type,
        message: t.description,
        status: t.status,
        createdAt: t.createdAt
    })));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};
