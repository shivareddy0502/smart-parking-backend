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
        createdAt: true,
        status: true
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

export const switchRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { role } = req.body; // 'driver' or 'owner'

    const targetRole = role.toUpperCase() === 'OWNER' ? 'OWNER' : 'DRIVER';

    const user = await prisma.user.update({
      where: { id: userId },
      data: { activeRole: targetRole as any }
    });

    res.json({ success: true, activeRole: user.activeRole.toLowerCase() });
  } catch (error) {
    res.status(500).json({ message: 'Failed to switch role' });
  }
}

export const getUnifiedDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    
    // 1. Get user with basic stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        bookings: {
          where: { status: { in: ['CONFIRMED', 'ACTIVE'] as any } },
          include: { spot: true, digitalKey: true },
          orderBy: { startTime: 'asc' },
          take: 1
        },
        _count: {
          select: { spots: true, bookings: true, notifications: { where: { read: false } } }
        }
      }
    }) as any;

    // 2. If Host, get current earnings and active device count
    let hostStats = null;
    if (user.role === 'HOST' || user.role === 'ADMIN') {
        const transactions = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { userId, type: 'EARNING', status: 'COMPLETED' }
        });
        const spots = await prisma.spot.findMany({
            where: { hostId: userId },
            include: { devices: true }
        });
        const activeDevices = spots.reduce((acc, s) => acc + s.devices.filter(d => d.status === 'ONLINE').length, 0);
        
        hostStats = {
            totalEarnings: transactions._sum?.amount || 0,
            activeSpots: user._count.spots,
            activeDevices
        };
    }

    res.json({
        profile: {
            name: user.name,
            activeRole: user.activeRole.toLowerCase(),
            unreadNotifications: user._count.notifications
        },
        activeBooking: user.bookings[0] || null,
        hostStats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading dashboard' });
  }
}

export const updatePushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { token } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken: token }
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating push token' });
  }
};
