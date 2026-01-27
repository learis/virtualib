import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getBooks, getBookById, createBook, updateBook, deleteBook, generateSummaryController, restoreBook } from '../controllers/book.controller';


const router = Router();

router.use(authenticate);

router.get('/', getBooks);
router.get('/:id', getBookById);

import { upload } from '../middlewares/upload.middleware';

// ... existing imports ...

// Admin and Librarian operations
router.post('/upload', authorize(['admin', 'librarian']), upload.single('cover'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Return the relative path that can be accessed via the static middleware
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ url: filePath });
});

router.post('/', authorize(['admin', 'librarian']), createBook);
router.post('/generate-summary', authorize(['admin', 'librarian']), generateSummaryController);
router.put('/:id', authorize(['admin', 'librarian']), updateBook);
router.post('/:id/restore', authorize(['admin', 'librarian']), restoreBook);
router.delete('/:id', authorize(['admin', 'librarian']), deleteBook);

export default router;
