import { Router } from 'express';
import { getRequests, createRequest, updateRequestStatus, deleteRequest } from '../controllers/request.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getRequests);
router.post('/', createRequest); // Any user can request
router.put('/:id', authorize(['admin', 'librarian']), updateRequestStatus); // Admin or Librarian
router.delete('/:id', deleteRequest); // User can cancel own request

export default router;
