import { Router } from 'express';
import { createBooking, getGuestBookings } from '../controllers/bookingController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// Guest booking routes
router.post('/', authenticate, authorizeRole(['GUEST']), createBooking);
router.get('/guest', authenticate, authorizeRole(['GUEST']), getGuestBookings);

export default router;
