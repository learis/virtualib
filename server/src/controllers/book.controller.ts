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
    library_id: z.string().optional(), // Added for Admin updates
    summary_tr: z.string().optional().nullable(),
    summary_en: z.string().optional().nullable(),
});

const updateBookSchema = createBookSchema.partial();

// Helper to check if user has permission to manage a book
function canManageBook(user: any, book: any): boolean {
    if (user.role?.role_name === 'admin') return true;
    if (user.role?.role_name === 'librarian') {
        const isOwner = book.library?.owner_id === user.id;
        // Check if assigned
        const isAssigned = user.libraries?.some((lib: any) => lib.id === book.library_id);

        return isOwner || !!isAssigned;
    }
    return false;
}

export const getBooks = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) return res.status(401).json({ message: 'Unauthorized' });

        const isAdmin = user.role?.role_name === 'admin';
        const { library_id } = req.query;

        const where: any = {};

        if (user.role?.role_name === 'librarian') {
            const ownedLibs = await prisma.library.findMany({
                where: { owner_id: user.id },
                select: { id: true }
            });
            // Get user's assigned libraries (from M:N relation)
            // We need to fetch user's libraries since they are not in the token/request object by default in a complete way (unless middleware adds it)
            // Efficient way: check Prisma for the user's libraries.
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

            const allowedIds = [...new Set([...ownedLibs.map(l => l.id), ...assignedIds])];
            // if (user.library_id) allowedIds.push(user.library_id); // Deprecated field check removed

            if (library_id) {
                if (!allowedIds.includes(library_id as string)) {
                    return res.json([]);
                }
                where.library_id = library_id as string;
            } else {
                if (allowedIds.length > 0) {
                    where.library_id = { in: allowedIds };
                } else {
                    return res.json([]);
                }
            }
            // Include soft-deleted books for librarians
            // No 'deleted_at' filter needed here as we want to see them (with styles)
        } else if (!isAdmin) {
            // Standard User
            // Get user's libraries
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

            if (assignedIds.length > 0) {
                where.library_id = { in: assignedIds };
            } else {
                return res.json([]);
            }
            where.deleted_at = null;
        } else {
            // Admin can filter by library
            if (library_id) {
                where.library_id = library_id as string;
            }
        }

        const books = await prisma.book.findMany({
            where,
            include: {
                categories: {
                    include: { category: true }
                },
                library: true, // Include Library details
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
        const isAdmin = user.role?.role_name === 'admin';

        const book = await prisma.book.findUnique({
            where: { id },
            include: {
                categories: {
                    include: { category: true }
                },
                library: true,
                loans: {
                    where: { returned_at: null }
                }
            }
        });

        if (!book) return res.status(404).json({ message: 'Book not found' });

        // Access Control
        if (!isAdmin) {
            const isOwner = book.library?.owner_id === user.id;
            const isAssigned = user.libraries?.some((l: any) => l.id === book.library_id);

            if (!isOwner && !isAssigned) {
                return res.status(404).json({ message: 'Book not found' });
            }
        }

        res.json(book);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch book', error });
    }
};

export const createBook = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const isAdmin = user.role?.role_name === 'admin';

        const validation = createBookSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid data', errors: validation.error.issues });
        }

        const { category_ids, ...bookData } = validation.data;

        // Determine Library ID
        // Determine Library ID
        let targetLibraryId = req.body.library_id;

        if (!isAdmin) {
            // Normalize: If not admin, they can't arbitralily pick unless they have access
            // Logic:
            // 1. If library_id provided, check access (owned or assigned)
            // 2. If not provided, default to first owned or first assigned.

            const ownedLib = await prisma.library.findFirst({ where: { owner_id: user.id } });
            const assignedLib = user.libraries?.[0];

            if (targetLibraryId) {
                const isOwned = ownedLib?.id === targetLibraryId;
                const isAssigned = user.libraries?.some((l: any) => l.id === targetLibraryId);
                if (!isOwned && !isAssigned) {
                    return res.status(403).json({ message: 'Forbidden: You do not have access to this library' });
                }
            } else {
                // Default to Owned then Assigned
                targetLibraryId = ownedLib?.id || assignedLib?.id;
                if (!targetLibraryId) {
                    return res.status(400).json({ message: 'No library assigned to user' });
                }
            }
        }

        // AI Summary Generation
        let summaries = {
            summary_tr: bookData.summary_tr || '',
            summary_en: bookData.summary_en || ''
        };

        if ((!summaries.summary_tr && !summaries.summary_en) && process.env.OPENAI_API_KEY) {
            const generated = await generateBookSummary(bookData.name, bookData.author);
            if (generated && !('error' in generated)) {
                summaries = generated;
            }
        }

        const book = await prisma.book.create({
            data: {
                ...bookData,
                library_id: targetLibraryId,
                summary_tr: summaries.summary_tr || null,
                summary_en: summaries.summary_en || null,
                categories: category_ids ? {
                    create: category_ids.map(id => ({
                        category: { connect: { id } }
                    }))
                } : undefined
            },
            include: {
                categories: { include: { category: true } },
                library: true
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
        const isAdmin = user.role?.role_name === 'admin';

        const existingBook = await prisma.book.findUnique({ where: { id } });

        if (!existingBook || !canManageBook(user, existingBook)) {
            return res.status(404).json({ message: 'Book not found or permission denied' });
        }

        const validation = updateBookSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid data', errors: validation.error.issues });
        }

        const { category_ids, ...bookData } = validation.data;
        const updateData: any = { ...bookData };

        // Ensure only Admin or Owner can update library_id
        if (updateData.library_id && !isAdmin) {
            const targetLib = await prisma.library.findUnique({ where: { id: updateData.library_id } });
            if (!targetLib || targetLib.owner_id !== user.id) {
                delete updateData.library_id; // Silently ignore if not allowed
            }
        }

        if (category_ids) {
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
                categories: { include: { category: true } },
                library: true
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
        const { type } = req.query;
        const user = (req as any).user;

        const existingBook = await prisma.book.findUnique({ where: { id } });
        if (!existingBook || !canManageBook(user, existingBook)) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (type === 'hard') {
            await prisma.book.delete({ where: { id } });
            res.json({ message: 'Book permanently deleted' });
        } else {
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
        if (!existingBook) return res.status(404).json({ message: 'Book not found' });

        // Check permission (Admin or Assigned or Owner)
        let hasPermission = false;
        if (canManageBook(user, existingBook)) {
            hasPermission = true;
        } else if (user.role?.role_name === 'librarian') {
            // Check ownership
            const hasOwnership = await prisma.library.count({
                where: {
                    id: existingBook.library_id,
                    owner_id: user.id
                }
            });
            if (hasOwnership > 0) hasPermission = true;
        }

        if (!hasPermission) {
            return res.status(403).json({ message: 'Forbidden' });
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
