import { Router } from 'express';
import { createLibrary, getLibrary, updateLibrary, getAllLibraries, deleteLibrary } from '../controllers/library.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Only Admins and Librarians can manage library details
router.get('/', authenticate, getAllLibraries);
router.post('/', authenticate, authorize(['admin', 'librarian']), createLibrary);
router.get('/:id', authenticate, getLibrary);
router.put('/:id', authenticate, authorize(['admin', 'librarian']), updateLibrary);
router.delete('/:id', authenticate, authorize(['admin', 'librarian']), deleteLibrary);

export default router;
