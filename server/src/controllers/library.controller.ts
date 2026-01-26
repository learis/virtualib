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
        const user = (req as any).user;
        const validation = createLibrarySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid input', errors: validation.error.issues });
        }

        const data: any = { ...validation.data };

        // If Librarian, forced ownership
        if (user.role.role_name === 'librarian') {
            data.owner_id = user.id;
        }

        const library = await prisma.library.create({
            data,
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
        const user = (req as any).user;

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

        // Ownership / Membership check
        const isOwner = library.owner_id === user.id;
        const isMember = user.role.role_name === 'librarian' && user.library_id === library.id;

        if (user.role.role_name === 'librarian' && !isOwner && !isMember) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this library' });
        }

        res.json(library);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch library' });
    }
};

export const updateLibrary = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;
        const data = createLibrarySchema.partial().parse(req.body);

        // Ownership / Membership Check
        const existing = await prisma.library.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Library not found' });

        const isOwner = existing.owner_id === user.id;
        const isMember = user.role.role_name === 'librarian' && user.library_id === existing.id;

        if (user.role.role_name === 'librarian' && !isOwner && !isMember) {
            return res.status(403).json({ message: 'Forbidden' });
        }

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
        const user = (req as any).user;

        // Ownership Check - Only Owner can delete? Or Member too?
        // Let's restricting DELETE to Owner only for safety, or Admin.
        // If Librarian is just a member, maybe they shouldn't delete the library.
        const existing = await prisma.library.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Library not found' });

        if (user.role.role_name === 'librarian' && existing.owner_id !== user.id) {
            return res.status(403).json({ message: 'Forbidden: Only the owner can delete the library' });
        }

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
        const user = (req as any).user;
        const where: any = {};

        // Librarian Filter: Owner OR Member
        if (user.role.role_name === 'librarian') {
            where.OR = [
                { owner_id: user.id },
                { id: user.library_id }
            ];
            // Prune nulls from OR if any (though id/owner_id are strings)
            // If user.library_id is null, it might match nothing, which is fine.
        }

        const libraries = await prisma.library.findMany({
            where,
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
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch libraries' });
    }
};
