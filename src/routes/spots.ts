import { Router } from 'express';
import { getAllSpots, getSpotById, getHostSpots, createSpot, getSavedSpots, saveSpot, unsaveSpot } from '../controllers/spotController';
import { authenticate, optionalAuthenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// Saved Spots (Protected for Guests/Hosts)
router.get('/saved', authenticate, getSavedSpots);
router.post('/saved/:spotId', authenticate, saveSpot);
router.delete('/saved/:spotId', authenticate, unsaveSpot);

// Public routes for guests
router.get('/', optionalAuthenticate, getAllSpots);
router.get('/:id', getSpotById);

// Protected routes for hosts
router.get('/host/listings', authenticate, authorizeRole(['HOST', 'GUEST']), getHostSpots);
router.post('/', authenticate, authorizeRole(['HOST', 'GUEST']), createSpot);
export default router;
