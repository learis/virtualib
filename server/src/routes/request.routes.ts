import { Router } from 'express';
import { getRequests, createRequest, updateRequestStatus } from '../controllers/request.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getRequests);
router.post('/', createRequest); // Any user can request
router.put('/:id', authorize(['admin']), updateRequestStatus); // Only admin decides

export default router;
