import { Router } from 'express';
import { getHostStats, getHostTransactions } from '../controllers/hostController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Protect all host routes
router.use(authenticate);

// Ensure user is at least HOST or ADMIN
router.use((req, res, next) => {
  const role = (req as any).user?.role;
  if (role !== 'HOST' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Requires Host Privileges' });
  }
  next();
});

router.get('/stats', getHostStats);
router.get('/transactions', getHostTransactions);

export default router;
