import { Router } from 'express';
import { login, googleLogin } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/google', googleLogin);

export default router;
