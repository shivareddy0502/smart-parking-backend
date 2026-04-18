import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logAction } from '../utils/auditLogger';

const prisma = new PrismaClient();

// Helper to ensure req.user exists and has types
interface AdminUser {
  id: string;
  email: string;
  name?: string;
}

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalDevices = await (prisma.device as any).count();

    const bookings = await (prisma.booking as any).aggregate({
      _sum: { totalAmount: true },
      where: { status: 'COMPLETED' } 
    });

    const totalVolume = bookings._sum?.totalAmount || 0;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await prisma.booking.findMany({
      where: { 
        status: 'COMPLETED',
        startTime: { gte: sixMonthsAgo }
      },
      select: { 
        startTime: true,
        totalAmount: true 
      }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMap: Record<string, number> = {};
    
    monthlyStats.forEach(b => {
      const month = monthNames[new Date(b.startTime).getMonth()];
      trendMap[month] = (trendMap[month] || 0) + b.totalAmount;
    });

    const revenueData = Object.keys(trendMap).map(name => ({
      name,
      value: trendMap[name]
    })).sort((a,b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));

    res.json({
      totalUsers,
      totalDevices,
      totalVolume,
      revenueData: revenueData.length > 0 ? revenueData : [{ name: 'N/A', value: 0 }]
    });
  } catch (error) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role.charAt(0) + u.role.slice(1).toLowerCase(),
      status: (u as any).status || 'Active',
      joinedAt: u.createdAt.toISOString().split('T')[0]
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getAllDevices = async (req: Request, res: Response) => {
  try {
    const devices = await (prisma.device as any).findMany({
      include: {
        spot: { include: { host: true } }
      }
    });

    const formatted = devices.map((d: any) => {
      const now = new Date();
      const lastSeen = new Date(d.lastHeartbeat);
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
      
      let calculatedHealth = 100 - (diffMinutes * 0.5);
      if (d.status === 'OFFLINE') calculatedHealth = Math.min(calculatedHealth, 25);
      calculatedHealth = Math.max(5, Math.min(99.9, calculatedHealth));

      return {
        id: d.id,
        macAddress: d.macAddress,
        status: d.status === 'ONLINE' ? 'Online' : 'Offline',
        health: parseFloat(calculatedHealth.toFixed(1)),
        lastSeen: d.lastHeartbeat,
        hostId: d.spot.host.id,
        hostName: d.spot.host.name
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: { in: ['CONFIRMED', 'COMPLETED', 'ACTIVE'] as any } },
      include: { guest: true, spot: true },
      orderBy: { startTime: 'desc' }
    });

    const formatted = bookings.map((b: any) => ({
      id: b.id,
      date: b.startTime.toISOString().split('T')[0],
      amount: b.totalAmount,
      type: 'Earning',
      status: b.status === 'COMPLETED' ? 'Completed' : 'Pending',
      user: b.guest?.name || 'Guest',
      bookingId: b.id
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getSystemAlerts = async (req: Request, res: Response) => {
  try {
    const offlineDevices = await (prisma.device as any).count({ where: { status: 'OFFLINE' } });
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

    const flatData = bookings.map((b: any) => ({
      BookingID: b.id,
      Date: b.startTime.toISOString(),
      Amount: b.totalAmount,
      GuestName: b.guest.name,
      GuestEmail: b.guest.email,
      SpotTitle: b.spot.title,
      HostName: b.spot.host.name,
      Status: b.status,
      GatewayProxy: b.paymentRef || 'N/A'
    }));

    const headers = ['BookingID', 'Date', 'Amount', 'GuestName', 'GuestEmail', 'SpotTitle', 'HostName', 'Status', 'GatewayProxy'];
    const csvRows = [headers.join(',')];
    
    for (const row of flatData) {
      const values = headers.map(header => `"${(row as any)[header]}"`);
      csvRows.push(values.join(','));
    }
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`platform_ledger_${new Date().getTime()}.csv`);
    return res.send(csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const admin = (req as any).user as AdminUser;

    await (prisma.user as any).update({
      where: { id },
      data: { status }
    });

    await logAction(admin.id, admin.email, 'UPDATE_USER_STATUS', 'User', id, { newStatus: status });
    res.json({ status: 'success', message: `User status changed to ${status}` });
  } catch (error) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const admin = (req as any).user as AdminUser;
    
    const targetUser = await prisma.user.findUnique({ where: { id } });
    await prisma.user.delete({ where: { id } });

    await logAction(admin.id, admin.email, 'DELETE_USER', 'User', id, { deletedEmail: targetUser?.email });
    res.json({ status: 'success', message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};

export const updateDeviceStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let { status } = req.body;
    const admin = (req as any).user as AdminUser;

    const enumStatus = status.toString().toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE';

    const device = await (prisma.device as any).update({ where: { id }, data: { status: enumStatus } });

    await (prisma as any).deviceLog.create({
      data: { deviceId: id, action: `STATUS_OVERRIDE_${enumStatus}`, performedBy: admin.name || admin.email }
    });

    await logAction(admin.id, admin.email, 'DEVICE_STATUS_OVERRIDE', 'Device', id, { newStatus: enumStatus, mac: device.macAddress });
    res.json({ status: 'success', message: 'Device status updated', data: device });
  } catch (error) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};

export const getDeviceDiagnostics = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const device = await (prisma.device as any).findUnique({
      where: { id },
      include: { logs: { orderBy: { timestamp: 'desc' }, take: 50 }, spot: true }
    });

    if (!device) return res.status(404).json({ status: 'fail', error: 'Not found' });

    const now = new Date();
    const lastSeen = new Date(device.lastHeartbeat);
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
    let health = Math.max(5, Math.min(100, 100 - (diffMinutes * 0.2)));
    if (device.status === 'OFFLINE') health = Math.min(health, 20);

    res.json({
      id: device.id, macAddress: device.macAddress, status: device.status,
      health: Math.round(health), lastHeartbeat: device.lastHeartbeat,
      logs: device.logs, spotTitle: device.spot.title
    });
  } catch (error) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};

export const flagTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = (req as any).user as AdminUser;

    await (prisma.transaction as any).update({ where: { id }, data: { isFlagged: true } });
    await logAction(admin.id, admin.email, 'FLAG_TRANSACTION', 'Transaction', id);

    res.json({ status: 'success', message: 'Flagged' });
  } catch (err) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await (prisma as any).auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 100 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};

export const forceHeartbeat = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = (req as any).user as AdminUser;

    await (prisma.device as any).update({ where: { id }, data: { lastHeartbeat: new Date(), status: 'ONLINE' } });
    await (prisma as any).deviceLog.create({
        data: { deviceId: id, action: 'FORCE_SYNC_HEARTBEAT', performedBy: admin.name || admin.email }
    });

    res.json({ status: 'success', message: 'Heartbeat signal successfully received from device.' });
  } catch (err) {
    res.status(500).json({ status: 'fail', error: 'Failed' });
  }
};
