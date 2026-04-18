import { Router } from 'express';
import { getHostDevices, controlDevice, reportHeartbeat } from '../controllers/deviceController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// Public route for hardware devices
router.post('/heartbeat', reportHeartbeat);

router.get('/', authenticate, authorizeRole(['HOST']), getHostDevices);
router.post('/:id/control', authenticate, authorizeRole(['HOST']), controlDevice);

export default router;
