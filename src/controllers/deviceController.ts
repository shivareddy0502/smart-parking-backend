import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getHostDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const devices = await prisma.device.findMany({
      where: {
        spot: { hostId }
      },
      include: {
        spot: { select: { title: true } }
      }
    });

    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching devices' });
  }
};

export const controlDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { action } = req.body; // 'RAISE' | 'LOWER' | 'REBOOT'

    const device = await prisma.device.findUnique({
      where: { id },
      include: { spot: true }
    });

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    if (device.spot.hostId !== req.user?.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Simulate sending a command to the ESP32
    res.json({ message: `Command '${action}' sent to device ${device.macAddress} successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Server error controlling device' });
  }
};
