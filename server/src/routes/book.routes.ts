import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getBooks, getBookById, createBook, updateBook, deleteBook, generateSummaryController, restoreBook } from '../controllers/book.controller';


const router = Router();

router.use(authenticate);

router.get('/', getBooks);
router.get('/:id', getBookById);

import { upload } from '../middlewares/upload.middleware';

// ... existing imports ...

// Admin only operations
router.post('/upload', authorize(['admin']), upload.single('cover'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Return the relative path that can be accessed via the static middleware
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ url: filePath });
});

router.post('/', authorize(['admin']), createBook);
router.post('/generate-summary', authorize(['admin']), generateSummaryController);
router.put('/:id', authorize(['admin']), updateBook);
router.post('/:id/restore', authorize(['admin']), restoreBook);
router.delete('/:id', authorize(['admin']), deleteBook);

export default router;
