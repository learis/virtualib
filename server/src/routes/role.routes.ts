import { Router } from 'express';
import { getRoles } from '../controllers/role.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getRoles);

export default router;
