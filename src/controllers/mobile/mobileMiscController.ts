import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../utils/prisma';

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const transactions = await prisma.transaction.findMany({
      where: { userId: userId! },
      orderBy: { createdAt: 'desc' }
    }) as any[];

    res.json(transactions.map(t => ({
      id: t.id,
      bookingId: t.bookingId,
      spotTitle: t.spotTitle || 'Parking Spot',
      amount: t.amount,
      type: t.type.toLowerCase(),
      status: t.status.toLowerCase(),
      createdAt: t.createdAt
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching transactions' });
  }
};

// Reviews
export const getReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { spotId } = req.query;
    const reviews = await prisma.review.findMany({
      where: spotId ? { spotId: spotId as string } : {},
      include: { guest: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    }) as any[];

    res.json(reviews.map(r => ({
      id: r.id,
      spotId: r.spotId,
      bookingId: r.bookingId,
      reviewerId: r.guestId,
      reviewerName: r.reviewerName || r.guest?.name || 'Reviewer',
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching reviews' });
  }
};

export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { spotId, bookingId, reviewerName, rating, comment } = req.body;

    const review = await prisma.review.create({
      data: {
        spotId,
        bookingId,
        guestId: userId!,
        reviewerName,
        rating: parseInt(rating),
        comment
      }
    });

    // Recompute spot rating
    const allReviews = await prisma.review.findMany({ where: { spotId } });
    const avgRating = allReviews.reduce((acc, curr) => acc + curr.rating, 0) / allReviews.length;
    
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating review' });
  }
};

// Saved Spots
export const getSavedSpots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const saved = await (prisma as any).savedSpot.findMany({
      where: { userId: userId! },
      select: { spotId: true }
    });
    res.json(saved.map((s: any) => s.spotId));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching saved spots' });
  }
};

export const toggleSavedSpot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { spotId } = req.body;

    const existing = await (prisma as any).savedSpot.findUnique({
      where: { userId_spotId: { userId: userId!, spotId } }
    });

    if (existing) {
      await (prisma as any).savedSpot.delete({
        where: { userId_spotId: { userId: userId!, spotId } }
      });
      res.json({ saved: false });
    } else {
      await (prisma as any).savedSpot.create({
        data: { userId: userId!, spotId }
      });
      res.json({ saved: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error toggling saved spot' });
  }
};

// Vehicles
export const getVehicles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const vehicles = await (prisma as any).vehicle.findMany({
      where: { userId: userId! }
    });
    
    res.json(vehicles.map((v: any) => ({
      id: v.id,
      name: v.name,
      type: v.type.replace('_', '-').toLowerCase(),
      plate: v.plate
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching vehicles' });
  }
};

const mapContractToCapacity = (cap: string) => {
    switch (cap) {
      case '2-wheeler': return 'TWO_WHEELER';
      case '4-wheeler': return 'FOUR_WHEELER';
      case '6-wheeler': return 'SIX_WHEELER';
      case '8-wheeler': return 'EIGHT_WHEELER';
      case '10-wheeler': return 'TEN_WHEELER';
      default: return 'FOUR_WHEELER';
    }
  };

export const createVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { name, type, plate } = req.body;

    const vehicle = await (prisma as any).vehicle.create({
      data: {
        userId: userId!,
        name,
        type: mapContractToCapacity(type),
        plate
      }
    });

    res.status(201).json({
        id: vehicle.id,
        name: vehicle.name,
        type: vehicle.type.replace('_', '-').toLowerCase(),
        plate: vehicle.plate
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error adding vehicle' });
  }
};

export const deleteVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const existing = await (prisma as any).vehicle.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ message: 'Vehicle not found' }); return; }
    if (existing.userId !== userId) { res.status(403).json({ message: 'Not authorized' }); return; }

    await (prisma as any).vehicle.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting vehicle' });
  }
};
