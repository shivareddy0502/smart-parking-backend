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

    const { spotId, rating, comment } = req.body;

    const review = await prisma.review.create({
      data: {
        spotId,
        guestId,
        rating: Number(rating),
        comment
      }
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: 'Server error posting review' });
  }
};
