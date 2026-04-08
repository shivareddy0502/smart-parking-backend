import { Router } from 'express';
import * as auth from '../controllers/mobile/mobileAuthController';
import * as user from '../controllers/mobile/mobileUserController';
import * as spot from '../controllers/mobile/mobileSpotController';
import * as booking from '../controllers/mobile/mobileBookingController';
import * as misc from '../controllers/mobile/mobileMiscController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Auth (No auth header needed)
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);

// Authenticated Routes
router.use(authenticate);

// Users
router.get('/users/me', user.getMe);
router.put('/users/me', user.updateMe);
router.post('/users/me/push-token', user.updatePushToken);

// Spots
router.get('/spots', spot.getAllSpots);
router.post('/spots', spot.createSpot);
router.put('/spots/:id', spot.updateSpot);
router.delete('/spots/:id', spot.deleteSpot);

// Bookings
router.get('/bookings', booking.getBookings);
router.post('/bookings', booking.createBooking);
router.put('/bookings/:id/accept', booking.acceptBooking);
router.put('/bookings/:id/decline', booking.declineBooking);
router.put('/bookings/:id/cancel', booking.cancelBooking);
router.put('/bookings/:id/complete', booking.completeBooking);
router.put('/bookings/:id/mark-key-used', booking.markKeyUsed);

// Transactions
router.get('/transactions', misc.getTransactions);

// Reviews
router.get('/reviews', misc.getReviews);
router.post('/reviews', misc.createReview);

// Saved Spots
router.get('/saved-spots', misc.getSavedSpots);
router.post('/saved-spots', misc.toggleSavedSpot);

// Vehicles
router.get('/vehicles', misc.getVehicles);
router.post('/vehicles', misc.createVehicle);
router.delete('/vehicles/:id', misc.deleteVehicle);

export default router;
