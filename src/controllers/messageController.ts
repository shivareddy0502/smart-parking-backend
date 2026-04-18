import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ],
        // Ensure the booking is not completed or cancelled
        booking: {
          NOT: {
            status: { in: ['COMPLETED', 'CANCELLED'] }
          }
        }
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
        booking: {
          include: {
            spot: { select: { title: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const senderId = req.user?.userId;
    if (!senderId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { receiverId, content, bookingId } = req.body;

    if (!bookingId) {
       res.status(400).json({ error: 'Booking ID is required' });
       return;
    }

    // Validate booking status
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      res.status(403).json({ error: 'Chat is locked for this booking' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
        bookingId
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error sending message' });
  }
};
