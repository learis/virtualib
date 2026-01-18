import { Router } from 'express';
import { createLibrary, getLibrary, updateLibrary, getAllLibraries, deleteLibrary } from '../controllers/library.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Only Admins can manage library details for now (or SuperAdmin if we had one)
router.get('/', authenticate, getAllLibraries);
router.post('/', authenticate, authorize(['admin']), createLibrary);
router.get('/:id', authenticate, getLibrary);
router.put('/:id', authenticate, authorize(['admin']), updateLibrary);
router.delete('/:id', authenticate, authorize(['admin']), deleteLibrary);

export default router;
