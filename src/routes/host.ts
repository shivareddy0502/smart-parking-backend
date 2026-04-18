import { Router } from 'express';
import { getHostStats, getHostTransactions, exportHostStatement, requestPayout } from '../controllers/hostController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// Protect all host routes
router.use(authenticate);

// Ensure user is at least HOST or ADMIN
// Ensure user is not an unauthorized role (in unified model, everyone is a host/guest)
router.use((req, res, next) => {
  const role = (req as any).user?.role;
  // Admin and Guest (assigned to "others") are allowed.
  if (role !== 'GUEST' && role !== 'ADMIN' && role !== 'HOST') {
    return res.status(403).json({ error: 'Requires Platform Privileges' });
  }
  next();
});

router.get('/stats', authenticate, authorizeRole(['HOST', 'GUEST']), getHostStats);
router.get('/transactions', authenticate, authorizeRole(['HOST', 'GUEST']), getHostTransactions);
router.get('/export', authenticate, authorizeRole(['HOST', 'GUEST']), exportHostStatement);
router.post('/payout', authenticate, authorizeRole(['HOST', 'GUEST']), requestPayout);

export default router;
