import { Router } from 'express';
import { getProfile, updateProfile, updateSecurity } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/security', authenticate, updateSecurity);

export default router;
