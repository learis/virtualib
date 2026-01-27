import { Router } from 'express';
import { getUsers, createUser, getUserById, updateUser, deleteUser } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Only admin and librarian can manage users
router.use(authenticate, authorize(['admin', 'librarian']));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
