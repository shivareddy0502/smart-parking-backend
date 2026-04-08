import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

// Get all spots (for Guest Search)
export const getAllSpots = async (req: Request, res: Response): Promise<void> => {
  try {
    const spots = await prisma.spot.findMany({
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
    if (!hostId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, address, pricePerHour, vehicleTypes, macAddress, latitude, longitude } = req.body;

    const features = [];
    if (vehicleTypes) {
      if (vehicleTypes.twowheeler) features.push('2W Compatible');
      if (vehicleTypes.fourwheeler) features.push('4W Compatible');
      if (vehicleTypes.sixwheeler) features.push('Heavy Vehicle Compatible');
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

    res.status(201).json(newSpot);
  } catch (error) {
    console.error('Error creating spot:', error);
    res.status(500).json({ error: 'Server error creating spot' });
  }
};
