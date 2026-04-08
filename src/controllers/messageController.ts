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
        ]
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } }
      },
      orderBy: { timestamp: 'asc' }
    });

    res.json(messages);
  } catch (error) {
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

    const { receiverId, content } = req.body;

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content
      }
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Server error sending message' });
  }
};
