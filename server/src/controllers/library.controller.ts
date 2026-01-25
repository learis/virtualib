import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const createLibrarySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
});

const updateLibrarySchema = createLibrarySchema.partial();

export const createLibrary = async (req: Request, res: Response) => {
    try {
        const validation = createLibrarySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid input', errors: validation.error.issues });
        }

        const library = await prisma.library.create({
            data: validation.data,
        });

        // Auto-create default settings
        await prisma.settings.create({
            data: { library_id: library.id }
        });

        res.status(201).json(library);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create library', error });
    }
};

export const getLibrary = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        // Security check: Users should primarily only see their own library
        // But for Admin Dashboard listing or SuperAdmin, logic might vary.
        // For now, simple fetch.
        const library = await prisma.library.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        books: true,
                        categories: true
                    }
                }
            }
        });
        if (!library) return res.status(404).json({ message: 'Library not found' });
        res.json(library);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch library' });
    }
};

export const updateLibrary = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const data = createLibrarySchema.partial().parse(req.body);

        const library = await prisma.library.update({
            where: { id },
            data
        });
        res.json(library);
    } catch (error) {
        res.status(500).json({ message: 'Error updating library' });
    }
};

export const deleteLibrary = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        await prisma.library.delete({
            where: { id }
        });
        res.json({ message: 'Library deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting library' });
    }
};
export const getAllLibraries = async (req: Request, res: Response) => {
    try {
        const libraries = await prisma.library.findMany({
            include: {
                _count: {
                    select: {
                        users: true,
                        books: true,
                        categories: true
                    }
                }
            }
        });
        res.json(libraries);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch libraries' });
    }
};
