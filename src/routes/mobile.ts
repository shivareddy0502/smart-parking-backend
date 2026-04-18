import { Router } from 'express';
import * as auth from '../controllers/mobile/mobileAuthController';
import * as user from '../controllers/mobile/mobileUserController';
import * as spot from '../controllers/mobile/mobileSpotController';
import * as booking from '../controllers/mobile/mobileBookingController';
import * as misc from '../controllers/mobile/mobileMiscController';
import * as support from '../controllers/mobile/mobileSupportController';
import * as admin from '../controllers/mobile/mobileAdminController';
import { authenticate } from '../middleware/auth';

const router = Router();

// --- Auth (Public) ---
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);

// --- Authenticated Routes ---
router.use(authenticate);

// Unified Dashboard
router.get('/dashboard', user.getUnifiedDashboard);

// User Profile & Role Switch
router.get('/users/me', user.getMe);
router.put('/users/me', user.updateMe);
router.post('/users/switch-role', user.switchRole);
router.post('/users/me/push-token', user.updatePushToken);

// Support & Issues
router.get('/support/tickets', support.getMyTickets);
router.post('/support/tickets', support.createTicket);

// Admin-on-mobile Logic
router.get('/admin/stats', admin.getAdminOverview);

// Spot Management (Unified Host/Guest)
router.get('/spots', spot.getAllSpots);
router.post('/spots', spot.createSpot);
router.put('/spots/:id', spot.updateSpot);
router.delete('/spots/:id', spot.deleteSpot);

// Booking Lifecycle
router.get('/bookings', booking.getBookings);
router.post('/bookings', booking.createBooking);
router.put('/bookings/:id/accept', booking.acceptBooking);
router.put('/bookings/:id/decline', booking.declineBooking);
router.put('/bookings/:id/cancel', booking.cancelBooking);
router.put('/bookings/:id/complete', booking.completeBooking);
router.put('/bookings/:id/mark-key-used', booking.markKeyUsed);

// Ledger & Interactions
router.get('/transactions', misc.getTransactions);
router.get('/reviews', misc.getReviews);
router.post('/reviews', misc.createReview);
router.get('/saved-spots', misc.getSavedSpots);
router.post('/saved-spots', misc.toggleSavedSpot);

// Vehicle Profiles
router.get('/vehicles', misc.getVehicles);
router.post('/vehicles', misc.createVehicle);
router.delete('/vehicles/:id', misc.deleteVehicle);

export default router;
