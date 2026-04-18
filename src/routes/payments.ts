import { Router } from 'express';
import { initiateUPIPayment, verifyUPIPayment, resumePayment } from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Guest initiates a new UPI payment
router.post('/initiate-upi', authenticate, initiateUPIPayment);

// Verify Razorpay signature and confirm booking
router.post('/verify-upi', authenticate, verifyUPIPayment);

// Resume payment for a pending booking (re-opens Razorpay with existing order)
router.get('/resume/:bookingId', authenticate, resumePayment);

export default router;

