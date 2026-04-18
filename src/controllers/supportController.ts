import { Request as ExpressRequest, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const createTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { reservationId, message, imageBase64, type } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let finalReservationId = null;
    const ticketType = type || 'SPOT_ISSUE';

    if (ticketType === 'SPOT_ISSUE') {
      if (!reservationId) {
        return res.status(400).json({ error: 'Reservation ID is required for spot issues' });
      }
      
      const booking = await prisma.booking.findUnique({
        where: { id: reservationId },
      });

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      finalReservationId = booking.id;
    }

    const ticket = await (prisma as any).supportTicket.create({
      data: {
        description: message,
        imageUrl: imageBase64,
        type: ticketType,
        reservationId: finalReservationId,
        guestId: userId,
        status: 'OPEN',
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    // Only ADMIN should access this usually, but middleware will check it
    const tickets = await (prisma as any).supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        guest: { select: { name: true, email: true } },
        booking: {
          include: {
            spot: { select: { title: true } },
          },
        },
      },
    });

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resolveTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ticket = await (prisma as any).supportTicket.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });

    res.json(ticket);
  } catch (error) {
    console.error('Resolve ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGuestTickets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tickets = await (prisma as any).supportTicket.findMany({
      where: { guestId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            spot: { select: { title: true, location: true } },
          },
        },
      },
    });

    res.json(tickets);
  } catch (error) {
    console.error('Get guest tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getHostTickets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find tickets where the booking's spot belongs to this host
    const tickets = await (prisma as any).supportTicket.findMany({
      where: {
        type: 'SPOT_ISSUE',
        booking: {
          spot: { hostId: userId }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        guest: { select: { name: true, email: true } },
        booking: {
          include: {
            spot: { select: { title: true, location: true } },
          },
        },
      },
    });

    res.json(tickets);
  } catch (error) {
    console.error('Get host tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const escalateTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Verify host owns the spot related to this ticket
    const ticket = await (prisma as any).supportTicket.findUnique({
      where: { id },
      include: { booking: { include: { spot: true } } }
    });

    if (!ticket || ticket.booking?.spot?.hostId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedTicket = await (prisma as any).supportTicket.update({
      where: { id },
      data: { isEscalated: true },
    });

    res.json(updatedTicket);
  } catch (error) {
    console.error('Escalate ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
