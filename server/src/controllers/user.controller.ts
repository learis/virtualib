import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { hashPassword } from '../utils/auth';
import { z } from 'zod';

const createUserSchema = z.object({
    name: z.string().min(1),
    surname: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    role_id: z.string().uuid(),
    library_ids: z.array(z.string().uuid()), // Changed to array
    password: z.string().min(6),
});

export const getUsers = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const role = user.role.role_name;

        const where: any = { deleted_at: null };

        // Librarian Filter
        if (role === 'librarian') {
            // Exclude admins
            where.role = { role_name: { not: 'admin' } };

            // Filter by assigned library OR owned libraries
            const ownedLibs = await prisma.library.findMany({
                where: { owner_id: user.id },
                select: { id: true }
            });
            const ownedIds = ownedLibs.map(l => l.id);

            // Get user's assigned libraries (from M:N relation)
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];

            const allowedIds = [...new Set([...ownedIds, ...assignedIds])];

            if (allowedIds.length > 0) {
                // Return users who have AT LEAST ONE library in common with allowedIds
                where.libraries = {
                    some: {
                        id: { in: allowedIds }
                    }
                };
            } else {
                return res.json([]);
            }
        }

        const users = await prisma.user.findMany({
            where,
            include: { role: true, libraries: true }, // Include libraries
        });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;
        const currentRole = currentUser.role.role_name;

        const data = createUserSchema.parse(req.body);

        // Librarian Restrictions
        if (currentRole === 'librarian') {
            // Verify librarian owns ALL target libraries (or at least has access? Owner is safer)
            const ownedLibs = await prisma.library.findMany({
                where: { owner_id: currentUser.id },
                select: { id: true }
            });
            const ownedIds = ownedLibs.map(l => l.id);

            const allOwned = data.library_ids.every(id => ownedIds.includes(id));
            if (!allOwned) {
                return res.status(403).json({ message: 'Forbidden: You can only assign users to libraries you own' });
            }

            // Check Role (Must be 'user')
            const targetRole = await prisma.role.findUnique({ where: { id: data.role_id } });
            if (targetRole?.role_name !== 'user') {
                return res.status(403).json({ message: 'Forbidden: Librarians can only create Users' });
            }
        }

        // Check if email unique (including soft-deleted)
        const existing = await prisma.user.findUnique({ where: { email: data.email } });

        if (existing) {
            if (existing.deleted_at) {
                return res.status(400).json({ message: 'User exists but is deleted. Please ask Admin to restore.' });
            }
            return res.status(400).json({ message: 'Email already exists' });
        }

        const { password, library_ids, ...userData } = data;
        const password_hash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                ...userData,
                password_hash,
                libraries: {
                    connect: library_ids.map(id => ({ id }))
                }
            },
            include: { libraries: true, role: true }
        });

        res.status(201).json(user);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input', errors: error.issues });
        }
        console.error(error);
        res.status(500).json({ message: 'Error creating user' });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const currentUser = (req as any).user;
        const currentRole = currentUser.role.role_name;

        const user = await prisma.user.findUnique({
            where: { id },
            include: { role: true, libraries: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Librarian Scope Check
        if (currentRole === 'librarian') {
            // Check if user is in any of Librarian's owned/assigned libraries
            const ownedLibs = await prisma.library.findMany({
                where: { owner_id: currentUser.id },
                select: { id: true }
            });
            const ownedIds = ownedLibs.map(l => l.id);
            if (currentUser.library_id) ownedIds.push(currentUser.library_id); // Wait, currentUser structure might have changed? For now assume token still has scalar if outdated, but DB has array.
            // Actually, currentUser comes from Auth Middleware which fetches from DB. I should update Auth Middleware too. 
            // But let's fetch currentUser libraries here to be safe if middleware isn't updated.
            const librarianWithLibs = await prisma.user.findUnique({ where: { id: currentUser.id }, include: { libraries: true } });
            const assignedIds = librarianWithLibs?.libraries.map(l => l.id) || [];
            const allowedIds = [...new Set([...ownedIds, ...assignedIds])];

            const hasCommonLibrary = user.libraries.some(lib => allowedIds.includes(lib.id));
            if (!hasCommonLibrary) return res.status(403).json({ message: 'Forbidden' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user' });
    }
};

const updateUserSchema = createUserSchema.partial();

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const currentUser = (req as any).user;
        const currentRole = currentUser.role.role_name;

        const parsed = updateUserSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
        const data = parsed.data;

        // Fetch User to check ownership
        const targetUser = await prisma.user.findUnique({ where: { id }, include: { libraries: true } });
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Librarian Scope Check
        if (currentRole === 'librarian') {
            const ownedLibs = await prisma.library.findMany({ where: { owner_id: currentUser.id }, select: { id: true } });
            const ownedIds = ownedLibs.map(l => l.id);

            // Can only update if target user is in owned library
            const isTargetInOwned = targetUser.libraries.some(lib => ownedIds.includes(lib.id));
            if (!isTargetInOwned) return res.status(403).json({ message: 'Forbidden' });

            // If updating libraries, ensure new libraries are also owned
            if (data.library_ids) {
                const allNewOwned = data.library_ids.every(id => ownedIds.includes(id));
                if (!allNewOwned) return res.status(403).json({ message: 'Forbidden: Cannot assign libraries you do not own' });
            }
        }

        let updateData: any = { ...data };
        delete updateData.library_ids; // Handle separately

        if (data.password) {
            updateData.password_hash = await hashPassword(data.password);
            delete updateData.password;
        }

        const transaction = await prisma.$transaction(async (tx) => {
            if (data.library_ids) {
                // Update libraries: disconnect all, connect new
                // Note: disconnect all might be aggressive if we want to merge? But usually UI sends full list.
                await tx.user.update({
                    where: { id },
                    data: {
                        libraries: {
                            set: [], // Disconnect all
                            connect: data.library_ids.map(lid => ({ id: lid }))
                        }
                    }
                });
            }

            return await tx.user.update({
                where: { id },
                data: updateData,
                include: { libraries: true, role: true }
            });
        });

        res.json(transaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const currentUser = (req as any).user;
        const currentRole = currentUser.role.role_name;

        // Fetch User to check ownership
        const targetUser = await prisma.user.findUnique({ where: { id }, include: { libraries: true } });
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Librarian Scope Check
        if (currentRole === 'librarian') {
            const ownedLibs = await prisma.library.findMany({ where: { owner_id: currentUser.id }, select: { id: true } });
            const ownedIds = ownedLibs.map(l => l.id);
            const isTargetInOwned = targetUser.libraries.some(lib => ownedIds.includes(lib.id));

            if (!isTargetInOwned) return res.status(403).json({ message: 'Forbidden' });
        }

        // Soft delete
        await prisma.user.update({
            where: { id },
            data: { deleted_at: new Date(), is_active: false }
        });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user' });
    }
};
