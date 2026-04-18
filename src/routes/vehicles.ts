import { Router } from 'express';
import { getVehicles, addVehicle, deleteVehicle } from '../controllers/vehicleController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getVehicles);
router.post('/', authenticate, addVehicle);
router.delete('/:id', authenticate, deleteVehicle);

export default router;
