import { Router } from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getCategories);
router.post('/', authenticate, authorize(['admin', 'librarian']), createCategory);
router.put('/:id', authenticate, authorize(['admin', 'librarian']), updateCategory);
router.delete('/:id', authenticate, authorize(['admin', 'librarian']), deleteCategory);

export default router;
