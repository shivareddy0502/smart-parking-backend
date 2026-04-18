import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../utils/prisma';

export const getAdminOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || user.role !== 'ADMIN') {
        res.status(403).json({ message: 'Admin access required' });
        return;
    }

    const [totalUsers, totalSpots, activeBookings, totalPendingEarnings] = await Promise.all([
        prisma.user.count(),
        prisma.spot.count(),
        prisma.booking.count({ where: { status: 'ACTIVE' as any } }),
        prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { type: 'EARNING', status: 'PENDING' }
        })
    ]);

    const recentLogs = await (prisma as any).auditLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' }
    });

    res.json({
        stats: {
            users: totalUsers,
            spots: totalSpots,
            activeBookings: activeBookings,
            totalPendingSettlement: totalPendingEarnings._sum?.amount || 0
        },
        recentActivity: recentLogs.map((l: any) => ({
            id: l.id,
            action: l.action,
            user: l.userEmail,
            time: l.timestamp
        }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading admin mobile overview' });
  }
};
