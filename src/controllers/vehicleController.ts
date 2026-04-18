import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getVehicles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const vehicles = await prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
};

export const addVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, type, plate } = req.body;

    if (!name || !type || !plate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        name,
        type,
        plate,
        userId: userId!
      }
    });

    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
};

export const deleteVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle || vehicle.userId !== userId) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await prisma.vehicle.delete({
      where: { id }
    });

    res.json({ message: 'Vehicle deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
};
