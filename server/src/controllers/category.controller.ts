import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { validateLibraryOwnership } from '../utils/validation';

const createCategorySchema = z.object({
    name: z.string().min(1),
    library_id: z.string().uuid(),
});

export const getCategories = async (req: Request, res: Response) => {
    try {
        const { library_id } = req.query;
        const user = (req as any).user;
        const role = user.role?.role_name;

        const where: any = {};

        // If Librarian, force filter by their library
        if (role === 'librarian') {
            const userLibrary = await prisma.library.findFirst({
                where: { owner_id: user.id }
            });

            if (userLibrary) {
                where.library_id = userLibrary.id;
            } else {
                // If for some reason a librarian has no library, return empty or error
                // returning empty array is safe
                return res.json([]);
            }
        } else if (library_id) {
            where.library_id = library_id as string;
        }

        const categories = await prisma.category.findMany({
            where,
            include: {
                library: true,
                _count: {
                    select: { books: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

export const createCategory = async (req: Request, res: Response) => {
    try {
        const data = createCategorySchema.parse(req.body);
        const user = (req as any).user;
        const role = user.role?.role_name;

        // Librarian Scope Check
        if (role === 'librarian') {
            const isOwned = await validateLibraryOwnership(user.id, data.library_id);
            if (!isOwned) {
                return res.status(403).json({ message: 'Forbidden: You do not own this library' });
            }
        }

        const category = await prisma.category.create({
            data
        });
        res.status(201).json(category);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input', errors: error.issues });
        }
        res.status(500).json({ message: 'Error creating category' });
    }
};

export const updateCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const { name } = req.body;
        const user = (req as any).user;
        const role = user.role?.role_name;

        if (!name) return res.status(400).json({ message: 'Name is required' });

        // Fetch category to check library ownership
        const category = await prisma.category.findUnique({
            where: { id },
            include: { library: true }
        });

        if (!category) return res.status(404).json({ message: 'Category not found' });

        // Librarian Scope Check
        if (role === 'librarian') {
            const isOwned = category.library.owner_id === user.id;
            if (!isOwned) return res.status(403).json({ message: 'Forbidden: You do not own this library' });
        }

        const updatedCategory = await prisma.category.update({
            where: { id },
            data: { name }
        });
        res.json(updatedCategory);
    } catch (error) {
        res.status(500).json({ message: 'Error updating category' });
    }
};

export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;
        const role = user.role?.role_name;

        // Fetch category to check library ownership
        const category = await prisma.category.findUnique({
            where: { id },
            include: { library: true }
        });

        if (!category) return res.status(404).json({ message: 'Category not found' });

        // Librarian Scope Check
        if (role === 'librarian') {
            const isOwned = category.library.owner_id === user.id;
            if (!isOwned) return res.status(403).json({ message: 'Forbidden: You do not own this library' });
        }

        await prisma.category.delete({
            where: { id }
        });
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        // Check for relation constraints if needed
        res.status(500).json({ message: 'Error deleting category' });
    }
};
