import { Router } from 'express';
import { getAllSpots, getSpotById, getHostSpots, createSpot } from '../controllers/spotController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// Public routes for guests
router.get('/', getAllSpots);
router.get('/:id', getSpotById);

// Protected routes for hosts
router.get('/host/listings', authenticate, authorizeRole(['HOST']), getHostSpots);
router.post('/', authenticate, authorizeRole(['HOST']), createSpot);

export default router;
