import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/auditLogger';

// Get all spots (for Guest Search)
export const getAllSpots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const where: any = {};

    if (userId) {
      where.NOT = { hostId: userId };
    }

    const spots = await prisma.spot.findMany({
      where,
      include: {
        host: { select: { name: true } },
        reviews: { select: { rating: true } },
      },
    });

    const formattedSpots = spots.map(spot => {
      const avgRating = spot.reviews.length > 0 
        ? spot.reviews.reduce((acc, curr) => acc + curr.rating, 0) / spot.reviews.length 
        : 0;
        
      return {
        ...spot,
        rating: Number(avgRating.toFixed(1)),
        reviewsCount: spot.reviews.length
      };
    });

    res.json(formattedSpots);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching spots' });
  }
};

// Get single spot (for Guest Spot Details)
export const getSpotById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const spot = await prisma.spot.findUnique({
      where: { id },
      include: {
        host: { select: { name: true, createdAt: true } },
        reviews: { select: { rating: true, comment: true, createdAt: true, guest: { select: { name: true } } } },
      },
    });

    if (!spot) {
      res.status(404).json({ error: 'Spot not found' });
      return;
    }

    res.json(spot);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching spot' });
  }
};

// Get spots for host (Dashboard)
export const getHostSpots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user?.userId;
    if (!hostId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const spots = await prisma.spot.findMany({
      where: { hostId },
      include: {
        devices: true,
        bookings: true
      }
    });

    res.json(spots);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching host spots' });
  }
};

// Create a new spot
export const createSpot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user?.userId;
    const hostEmail = (req as any).user?.email || 'host@sys';
    if (!hostId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, address, pricePerHour, vehicleTypes, macAddress, latitude, longitude } = req.body;

    const features = [];
    let capacity = 'FOUR_WHEELER';

    if (vehicleTypes) {
      if (vehicleTypes.twowheeler) {
        features.push('2W Compatible');
        capacity = 'TWO_WHEELER';
      }
      if (vehicleTypes.fourwheeler) {
        features.push('4W Compatible');
        capacity = 'FOUR_WHEELER';
      }
      if (vehicleTypes.sixwheeler) {
        features.push('Heavy Vehicle Compatible');
        capacity = 'SIX_WHEELER';
      }
    }

    const newSpot = await prisma.spot.create({
      data: {
        title: name,
        location: address,
        description: 'Host-configured Smart Parking Spot',
        latitude: latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : null,
        longitude: longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : null,
        rate: parseFloat(pricePerHour),
        features,
        capacity: capacity as any,
        hostId,
        devices: macAddress ? {
          create: {
            macAddress,
            status: 'ONLINE',
            lastHeartbeat: new Date()
          }
        } : undefined
      },
    });

    // PLATFORM LOG
    await logAction(hostId, hostEmail, 'REGISTER_SPOT', 'Spot', newSpot.id, { spotTitle: name, mac: macAddress });

    res.status(201).json(newSpot);
  } catch (error) {
    console.error('Error creating spot:', error);
    res.status(500).json({ error: 'Server error creating spot' });
  }
};
export const getSavedSpots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const saved = await (prisma as any).savedSpot.findMany({
      where: { userId },
      select: { spotId: true }
    });
    res.json(saved.map((s: any) => s.spotId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching saved spots' });
  }
};

export const saveSpot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { spotId } = req.params;
    await (prisma as any).savedSpot.upsert({
      where: { userId_spotId: { userId, spotId } },
      create: { userId, spotId },
      update: {}
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error saving spot' });
  }
};

export const unsaveSpot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { spotId } = req.params;
    await (prisma as any).savedSpot.deleteMany({
      where: { userId, spotId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error unsaving spot' });
  }
};
