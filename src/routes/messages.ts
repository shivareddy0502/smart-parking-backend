import { Router } from 'express';
import { getConversations, sendMessage } from '../controllers/messageController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getConversations);
router.post('/', authenticate, sendMessage);

export default router;
