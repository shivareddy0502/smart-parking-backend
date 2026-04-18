import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const postReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const guestId = req.user?.userId;
    if (!guestId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { spotId, rating, comment, bookingId } = req.body;
    
    if (!spotId || rating == null) {
      res.status(400).json({ error: 'Spot ID and Rating are required.' });
      return;
    }
    
    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5.' });
      return;
    }

    // Optionally check if user actually had a completed booking for this spot
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, guestId, spotId, status: 'COMPLETED' }
      });
      if (!booking) {
        res.status(403).json({ error: 'You can only review completed reservations.' });
        return;
      }
    }

    const review = await prisma.review.create({
      data: {
        spotId,
        guestId,
        bookingId: bookingId || null,
        rating: Number(rating),
        comment
      }
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Error posting review:', error);
    res.status(500).json({ error: 'Server error posting review' });
  }
};
