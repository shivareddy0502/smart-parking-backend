import { Router } from 'express';
import { getHostDevices, controlDevice } from '../controllers/deviceController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorizeRole(['HOST']), getHostDevices);
router.post('/:id/control', authenticate, authorizeRole(['HOST']), controlDevice);

export default router;
