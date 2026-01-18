import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, authorize(['admin']));

router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/test-email', (req, res, next) => {
    import('../controllers/settings.controller').then(c => c.sendTestEmail(req, res)).catch(next);
});

export default router;
