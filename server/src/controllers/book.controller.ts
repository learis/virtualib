import { Request, Response } from 'express';
import { z } from 'zod'; // Import z directly
import prisma from '../lib/prisma';
import { generateBookSummary } from '../services/openai.service';

// Validation Schemas
const createBookSchema = z.object({
    name: z.string().min(1),
    author: z.string().min(1),
    publish_year: z.number().int(),
    isbn: z.string().min(10),
    publisher: z.string().min(1),
    cover_image_path: z.string().optional().or(z.literal('')),
    category_ids: z.array(z.string()).optional(), // Array of Category IDs
    summary_tr: z.string().optional().nullable(),
    summary_en: z.string().optional().nullable(),
});

const updateBookSchema = createBookSchema.partial();

export const getBooks = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.library_id) return res.status(401).json({ message: 'Unauthorized' });

        const isAdmin = user.role?.role_name === 'admin';
        const where: any = { library_id: user.library_id };

        if (!isAdmin) {
            where.deleted_at = null;
        }

        const books = await prisma.book.findMany({
            where,
            include: {
                categories: {
                    include: { category: true }
                },
                loans: {
                    where: { returned_at: null }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch books', error });
    }
};

export const getBookById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;

        const book = await prisma.book.findUnique({
            where: { id },
            include: {
                categories: {
                    include: { category: true }
                },
                loans: {
                    where: { returned_at: null }
                }
            }
        });

        if (!book || book.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.json(book);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch book', error });
    }
};

export const createBook = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const validation = createBookSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid data', errors: validation.error.issues });
        }

        const { category_ids, ...bookData } = validation.data;

        // AI Summary Generation
        let summaries = {
            summary_tr: bookData.summary_tr || '',
            summary_en: bookData.summary_en || ''
        };

        // Only generate if NOT provided by frontend AND API Key exists
        if ((!summaries.summary_tr && !summaries.summary_en) && process.env.OPENAI_API_KEY) {
            const generated = await generateBookSummary(bookData.name, bookData.author);
            if (generated && !('error' in generated)) {
                summaries = generated;
            }
        }

        const book = await prisma.book.create({
            data: {
                ...bookData,
                library_id: user.library_id,
                summary_tr: summaries.summary_tr || null,
                summary_en: summaries.summary_en || null,
                categories: category_ids ? {
                    create: category_ids.map(id => ({
                        category: { connect: { id } }
                    }))
                } : undefined
            },
            include: {
                categories: { include: { category: true } }
            }
        });

        res.status(201).json(book);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create book', error });
    }
};

export const updateBook = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;

        // Check existence and scope
        const existingBook = await prisma.book.findUnique({ where: { id } });
        if (!existingBook || existingBook.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Book not found' });
        }

        console.log('[updateBook] Incoming Body:', req.body);

        const validation = updateBookSchema.safeParse(req.body);
        if (!validation.success) {
            console.error('[updateBook] Validation Error:', validation.error);
            return res.status(400).json({ message: 'Invalid data', errors: validation.error.issues });
        }

        console.log('[updateBook] Parsed Data:', validation.data);

        const { category_ids, ...bookData } = validation.data;

        // If implementing category updates, we'd delete existing relations and create new ones.
        // For simplicity, handle basic fields first.

        const updateData: any = { ...bookData };

        if (category_ids) {
            // Transaction-like update for relations
            // Prisma update with 'set' can handle this cleanly if structure matches
            // But many-to-many explicit table is tricky.
            // We will wipe and recreate for simplicity in this MVP step
            await prisma.bookCategory.deleteMany({ where: { book_id: id } });
            updateData.categories = {
                create: category_ids.map(id => ({
                    category: { connect: { id } }
                }))
            };
        }

        const updatedBook = await prisma.book.update({
            where: { id },
            data: updateData,
            include: {
                categories: { include: { category: true } }
            }
        });

        res.json(updatedBook);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update book', error });
    }
};

export const deleteBook = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const { type } = req.query; // 'hard' or 'soft' (default)
        const user = (req as any).user;

        const existingBook = await prisma.book.findUnique({ where: { id } });
        if (!existingBook || existingBook.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (type === 'hard') {
            await prisma.book.delete({ where: { id } });
            res.json({ message: 'Book permanently deleted' });
        } else {
            // Soft delete
            await prisma.book.update({
                where: { id },
                data: { deleted_at: new Date() }
            });
            res.json({ message: 'Book disabled (soft deleted)' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete book', error });
    }
};

export const restoreBook = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;

        const existingBook = await prisma.book.findUnique({ where: { id } });
        if (!existingBook || existingBook.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Book not found' });
        }

        await prisma.book.update({
            where: { id },
            data: { deleted_at: null }
        });
        res.json({ message: 'Book restored successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to restore book', error });
    }
};

export const generateSummaryController = async (req: Request, res: Response) => {
    try {
        const { name, author } = req.body;
        if (!name || !author) {
            return res.status(400).json({ message: 'Name and author are required' });
        }

        const summary = await generateBookSummary(name, author);

        if (!summary) {
            return res.status(500).json({ message: 'Failed to generate summary' });
        }

        if ('error' in summary) {
            return res.status(500).json({ message: summary.error });
        }

        res.json(summary);
    } catch (error) {
        res.status(500).json({ message: 'Error generating summary', error });
    }
};
