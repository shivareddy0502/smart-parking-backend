import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../utils/prisma';

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        activeRole: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      ...user,
      activeRole: user.activeRole.toLowerCase()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { name, email, phone, activeRole } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        phone,
        activeRole: activeRole ? activeRole.toUpperCase() : undefined
      }
    });

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      activeRole: updatedUser.activeRole.toLowerCase(),
      createdAt: updatedUser.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

export const updatePushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { token } = req.body;

    if (!token) {
       res.status(400).json({ message: 'Token is required' });
       return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken: token }
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating push token' });
  }
};
