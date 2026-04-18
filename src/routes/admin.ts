import { Router } from 'express';
import { 
  getAdminStats, 
  getAllUsers, 
  getAllDevices, 
  getAllTransactions, 
  getSystemAlerts, 
  exportPlatformData,
  updateUserStatus,
  deleteUser,
  updateDeviceStatus,
  getDeviceDiagnostics,
  flagTransaction,
  getAuditLogs,
  forceHeartbeat
} from '../controllers/adminController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Protect all admin routes
router.use(authenticate);

// Admin Role Check
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
router.get('/logs', getAuditLogs);

// Multi-Action Management
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.put('/devices/:id/status', updateDeviceStatus);
router.post('/devices/:id/sync', forceHeartbeat);
router.get('/devices/:id/diagnostics', getDeviceDiagnostics);
router.put('/transactions/:id/flag', flagTransaction);

export default router;
