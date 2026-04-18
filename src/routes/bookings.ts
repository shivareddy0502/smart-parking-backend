import { Router } from 'express';
import { createBooking, getGuestBookings, getHostBookings, cancelBooking, getBookingById } from '../controllers/bookingController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// Guest booking routes
router.post('/', authenticate, authorizeRole(['GUEST', 'HOST']), createBooking);
router.get('/guest', authenticate, authorizeRole(['GUEST', 'HOST']), getGuestBookings);

// Host booking routes
router.get('/host', authenticate, authorizeRole(['HOST', 'GUEST']), getHostBookings);

// Single booking detail (for success page)
router.get('/:id', authenticate, getBookingById);

// Shared cancel route
router.post('/cancel/:id', authenticate, cancelBooking);

export default router;

