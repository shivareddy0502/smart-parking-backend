import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalDevices = await prisma.device.count();

    // Aggregate total sum of completed bookings
    const bookings = await prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'COMPLETED' } 
    });

    const totalVolume = (bookings._sum as any)?.totalAmount || 0;

    // Fake revenue data trend for visual charts until historical reporting is built
    const revenueData = [
      { name: 'Jan', value: totalVolume * 0.2 },
      { name: 'Feb', value: totalVolume * 0.3 },
      { name: 'Mar', value: totalVolume * 0.5 },
    ];

    res.json({
      totalUsers,
      totalDevices,
      totalVolume,
      revenueData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role.charAt(0) + u.role.slice(1).toLowerCase(),
      status: 'Active',
      joinedAt: u.createdAt.toISOString().split('T')[0]
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getAllDevices = async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        spot: {
          include: { host: true }
        }
      }
    });

    const formatted = devices.map(d => ({
      id: d.id,
      macAddress: d.macAddress,
      status: d.status === 'ONLINE' ? 'Online' : 'Offline',
      health: 98,
      lastSeen: d.lastHeartbeat,
      hostId: d.spot.host.id,
      hostName: d.spot.host.name
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] as any } },
      include: {
        guest: true,
      },
      orderBy: { startTime: 'desc' }
    });

    const formatted = bookings.map((b: any) => ({
      id: b.id,
      date: b.startTime.toISOString().split('T')[0],
      amount: b.totalAmount,
      type: 'Earning',
      status: 'Completed',
      user: b.guest?.name || 'Guest'
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getSystemAlerts = async (req: Request, res: Response) => {
  try {
    const offlineDevices = await prisma.device.count({
      where: { status: 'OFFLINE' }
    });

    const alerts = [];
    if (offlineDevices > 0) {
      alerts.push({
        id: 'alert-1',
        type: 'warning',
        title: 'IoT Connectivity Drop',
        message: `${offlineDevices} offline IoT devices require maintenance follow-up.`
      });
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const exportPlatformData = async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        guest: { select: { name: true, email: true } },
        spot: { select: { title: true, host: { select: { name: true } } } }
      },
      orderBy: { startTime: 'desc' }
    });

    const flatData = bookings.map(b => ({
      BookingID: b.id,
      Date: b.startTime.toISOString(),
      Amount: b.totalAmount,
      GuestName: b.guest.name,
      GuestEmail: b.guest.email,
      SpotTitle: b.spot.title,
      HostName: b.spot.host.name,
      Status: b.status,
      GatewayProxy: b.razorpayOrderId || 'N/A'
    }));

    const defaultHeaders = [
      'BookingID', 'Date', 'Amount', 'GuestName', 'GuestEmail', 'SpotTitle', 'HostName', 'Status', 'GatewayProxy'
    ];
    
    const headers = flatData.length > 0 ? Object.keys(flatData[0]) : defaultHeaders;
    const csvRows = [headers.join(',')];
    
    for (const row of flatData) {
      const values = headers.map(header => {
        const cellValue = row[header as keyof typeof row];
        const valStr = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
        return `"${valStr.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const csv = csvRows.join('\n');
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`platform_ledger_${new Date().getTime()}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Export errored', error);
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
};
