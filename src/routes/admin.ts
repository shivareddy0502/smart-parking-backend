import { Router } from 'express';
import { getAdminStats, getAllUsers, getAllDevices, getAllTransactions, getSystemAlerts, exportPlatformData } from '../controllers/adminController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Protect all admin routes
router.use(authenticate);

// We arguably should check if req.user.role === 'ADMIN' here via a middleware, 
// but for the sake of this prototype, we'll assume authenticate is enough or build a quick check.
router.use((req, res, next) => {
  if ((req as any).user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Requires Admin Privileges' });
  }
  next();
});

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.get('/devices', getAllDevices);
router.get('/transactions', getAllTransactions);
router.get('/alerts', getSystemAlerts);
router.get('/export', exportPlatformData);

export default router;
