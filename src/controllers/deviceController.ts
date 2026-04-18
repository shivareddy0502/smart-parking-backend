import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Public endpoint for IoT Hardware to report health/connectivity
 */
export const reportHeartbeat = async (req: Request, res: Response) => {
  try {
    const { macAddress, status } = req.body;

    if (!macAddress) {
      return res.status(400).json({ error: 'MAC Address is required' });
    }

    const device = await (prisma.device as any).update({
      where: { macAddress },
      data: {
        status: status?.toUpperCase() === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
        lastHeartbeat: new Date(),
      }
    });

    res.json({ status: 'success', message: 'Heartbeat acknowledged', device: device.macAddress });
  } catch (error) {
    console.error('Heartbeat failed:', error);
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
};

export const getHostDevices = async (req: Request, res: Response) => {
  try {
    const hostId = (req as any).user.id;
    const devices = await (prisma.device as any).findMany({
      where: { spot: { hostId } },
      include: { spot: true }
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const controlDevice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // e.g., 'REBOOT', 'TOGGLE'
    
    // Simulate relay signal
    await (prisma as any).deviceLog.create({
      data: {
        deviceId: id,
        action: `REMOTE_${action}`,
        performedBy: (req as any).user.name || 'Host'
      }
    });

    res.json({ status: 'success', message: `Signal ${action} sent to device.` });
  } catch (error) {
    res.status(500).json({ status: 'fail', error: 'Control failed' });
  }
};
