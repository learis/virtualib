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

        // If Librarian, filter by ALL their libraries (assigned + owned)
        if (role === 'librarian') {
            const ownedLibs = await prisma.library.findMany({
                where: { owner_id: user.id },
                select: { id: true }
            });

            // Get user's assigned libraries (from M:N relation)
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

            const allAllowedIds = [...new Set([...ownedLibs.map(l => l.id), ...assignedIds])];

            // If specific library requested, ensure it's allowed
            if (library_id) {
                if (!allAllowedIds.includes(library_id as string)) {
                    return res.json([]);
                }
                where.library_id = library_id;
            } else {
                if (allAllowedIds.length > 0) {
                    where.library_id = { in: allAllowedIds };
                } else {
                    return res.json([]);
                }
            }
        } else if (role !== 'admin') {
            // Normal User
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

            // Filter by specific library if requested
            if (library_id) {
                if (assignedIds.includes(library_id as string)) {
                    where.library_id = library_id as string;
                } else {
                    return res.json([]);
                }
            }
        } else {
            // Admin
            if (library_id) {
                where.library_id = library_id as string;
            }
        }

        const categories = await prisma.category.findMany({
            where,
            include: {
                library: true,
                created_by: {
                    select: {
                        name: true,
                        surname: true,
                        email: true
                    }
                },
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
            // Must belong to their assigned libraries or owned
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

            // Check ownership
            const isOwned = await validateLibraryOwnership(user.id, data.library_id);
            const isAssigned = assignedIds.includes(data.library_id);

            if (!isAssigned && !isOwned) {
                return res.status(403).json({ message: 'Forbidden: You do not have access to this library' });
            }
        }

        const category = await prisma.category.create({
            data: {
                ...data,
                created_by_id: user.id
            }
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
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

            const isAssigned = assignedIds.includes(category.library_id);
            const isOwned = category.library.owner_id === user.id;

            if (!isAssigned && !isOwned) return res.status(403).json({ message: 'Forbidden' });
        }

        // Handle library_id update
        let libraryIdToUpdate = undefined;
        if (req.body.library_id) {
            libraryIdToUpdate = req.body.library_id;
            // Validate access to new library
            if (role === 'librarian') {
                const userWithLibs = await prisma.user.findUnique({ where: { id: user.id }, include: { libraries: true } });
                const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

                const targetLib = await prisma.library.findUnique({ where: { id: libraryIdToUpdate } });
                const isOwned = targetLib?.owner_id === user.id;
                const isAssigned = assignedIds.includes(libraryIdToUpdate);

                if (!targetLib || (!isOwned && !isAssigned)) {
                    return res.status(403).json({ message: 'Forbidden: You do not access to the target library' });
                }
            }
        }

        const updatedCategory = await prisma.category.update({
            where: { id },
            data: {
                name,
                ...(libraryIdToUpdate ? { library_id: libraryIdToUpdate } : {})
            }
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
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

            const isAssigned = assignedIds.includes(category.library_id);
            const isOwned = category.library.owner_id === user.id;

            if (!isAssigned && !isOwned) return res.status(403).json({ message: 'Forbidden' });
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
