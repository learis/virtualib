import { Router } from 'express';
import { createLoan, getLoans, requestReturn, approveReturn, rejectReturn, cancelReturnRequest } from '../controllers/loan.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', createLoan);
router.get('/', getLoans);
router.post('/:id/return-request', requestReturn);
router.post('/:id/return', authorize(['admin']), approveReturn);
router.post('/:id/reject', authorize(['admin']), rejectReturn);
router.post('/:id/cancel-return', cancelReturnRequest);

export default router;
