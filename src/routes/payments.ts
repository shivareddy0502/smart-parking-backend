import { Router } from 'express';
import { createOrder, handleWebhook } from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Guest creates a new payment order
router.post('/create-order', authenticate, createOrder);

// Razorpay Webhook processor
router.post('/webhook', handleWebhook);

export default router;
