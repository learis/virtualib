import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

const createCategorySchema = z.object({
    name: z.string().min(1),
    library_id: z.string().uuid(),
});

export const getCategories = async (req: Request, res: Response) => {
    try {
        const { library_id } = req.query;
        const where: any = {};

        if (library_id) {
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
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

export const createCategory = async (req: Request, res: Response) => {
    try {
        const data = createCategorySchema.parse(req.body);
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

        if (!name) return res.status(400).json({ message: 'Name is required' });

        const category = await prisma.category.update({
            where: { id },
            data: { name }
        });
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: 'Error updating category' });
    }
};

export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        await prisma.category.delete({
            where: { id }
        });
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        // Check for relation constraints if needed
        res.status(500).json({ message: 'Error deleting category' });
    }
};
