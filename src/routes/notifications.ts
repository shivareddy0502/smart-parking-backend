import { Router } from 'express';
import { getMyNotifications, markAllRead } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getMyNotifications);
router.post('/read-all', markAllRead);

export default router;
