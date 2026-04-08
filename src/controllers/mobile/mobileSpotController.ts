import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../utils/prisma';
const mapCapacityToContract = (cap: any): string => {
  switch (cap) {
    case 'TWO_WHEELER': return '2-wheeler';
    case 'FOUR_WHEELER': return '4-wheeler';
    case 'SIX_WHEELER': return '6-wheeler';
    case 'EIGHT_WHEELER': return '8-wheeler';
    case 'TEN_WHEELER': return '10-wheeler';
    default: return '4-wheeler';
  }
};

const mapContractToCapacity = (cap: string): any => {
  switch (cap) {
    case '2-wheeler': return 'TWO_WHEELER';
    case '4-wheeler': return 'FOUR_WHEELER';
    case '6-wheeler': return 'SIX_WHEELER';
    case '8-wheeler': return 'EIGHT_WHEELER';
    case '10-wheeler': return 'TEN_WHEELER';
    default: return 'FOUR_WHEELER';
  }
};

export const getAllSpots = async (req: Request, res: Response): Promise<void> => {
  try {
    const spots = await prisma.spot.findMany({
      include: {
        host: { select: { name: true } }
      }
    }) as any;

    const formatted = spots.map((s: any) => ({
      id: s.id,
      ownerId: s.hostId,
      ownerName: s.host?.name || 'Owner',
      title: s.title,
      address: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      capacity: mapCapacityToContract(s.capacity || 'FOUR_WHEELER'),
      pricePerHour: s.rate,
      pricePerDay: s.pricePerDay || 0,
      isAvailable: true,
      availableFrom: s.availableFrom || '06:00',
      availableTo: s.availableTo || '23:00',
      description: s.description,
      rating: 4.5,
      totalBookings: s.totalBookings || 0,
      photos: s.photos || [],
      createdAt: s.createdAt
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching spots' });
  }
};

export const createSpot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { 
      title, address, latitude, longitude, capacity, 
      pricePerHour, pricePerDay, availableFrom, availableTo, 
      description, photos 
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    const spot = await prisma.spot.create({
      data: {
        title,
        location: address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        capacity: mapContractToCapacity(capacity) as any,
        rate: parseFloat(pricePerHour),
        pricePerDay: parseFloat(pricePerDay) || 0,
        availableFrom: availableFrom || '06:00',
        availableTo: availableTo || '23:00',
        description,
        photos: photos || [],
        hostId: userId!
      }
    }) as any;

    res.status(201).json({
       ...spot,
       ownerId: spot.hostId,
       ownerName: user.name,
       capacity: mapCapacityToContract(spot.capacity),
       rating: 4.5,
       totalBookings: 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error creating spot' });
  }
};

export const updateSpot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    const data = req.body;

    const existing = await prisma.spot.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ message: 'Spot not found' }); return; }
    if (existing.hostId !== userId) { res.status(403).json({ message: 'Not authorized' }); return; }

    if (data.capacity) data.capacity = mapContractToCapacity(data.capacity) as any;
    if (data.pricePerHour) {
        data.rate = parseFloat(data.pricePerHour);
        delete data.pricePerHour;
    }
    if (data.address) {
        data.location = data.address;
        delete data.address;
    }

    const updated = await prisma.spot.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error updating spot' });
  }
};

export const deleteSpot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const existing = await prisma.spot.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ message: 'Spot not found' }); return; }
    if (existing.hostId !== userId) { res.status(403).json({ message: 'Not authorized' }); return; }

    await prisma.spot.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting spot' });
  }
};
