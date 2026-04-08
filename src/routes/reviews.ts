import { Router } from 'express';
import { postReview } from '../controllers/reviewController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, authorizeRole(['GUEST']), postReview);

export default router;
