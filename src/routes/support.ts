import { Router } from 'express';
import { createTicket, getTickets, resolveTicket, getGuestTickets, getHostTickets, escalateTicket } from '../controllers/supportController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// Guest creates and views their tickets
router.post('/', authenticate, createTicket);
router.get('/guest', authenticate, getGuestTickets);

// Host routes
router.get('/host', authenticate, authorizeRole(['HOST']), getHostTickets);
router.put('/:id/escalate', authenticate, authorizeRole(['HOST']), escalateTicket);
router.put('/:id/resolve', authenticate, authorizeRole(['HOST']), resolveTicket);

// Admin routes
router.get('/admin', authenticate, authorizeRole(['ADMIN']), getTickets);
router.put('/admin/:id/resolve', authenticate, authorizeRole(['ADMIN']), resolveTicket);

export default router;
