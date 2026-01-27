import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { hashPassword } from '../utils/auth';
import { z } from 'zod';
import { validateLibraryOwnership } from '../utils/validation';

const createUserSchema = z.object({
    name: z.string().min(1),
    surname: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    role_id: z.string().uuid(),
    library_id: z.string().uuid(),
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
            const allowedIds = ownedLibs.map(l => l.id);
            if (user.library_id) allowedIds.push(user.library_id);

            if (allowedIds.length > 0) {
                where.library_id = { in: allowedIds };
            } else {
                where.library_id = '00000000-0000-0000-0000-000000000000'; // Return none effectively
            }
        }

        const users = await prisma.user.findMany({
            where,
            include: { role: true, library: true },
        });
        res.json(users);
    } catch (error) {
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
            const targetLibraryOwned = await validateLibraryOwnership(currentUser.id, data.library_id);
            if (!targetLibraryOwned) {
                return res.status(403).json({ message: 'Forbidden: You do not own this library' });
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
                // Reactivate soft-deleted user
                const { password, ...userData } = data;
                const password_hash = await hashPassword(password);

                const reactivatedUser = await prisma.user.update({
                    where: { id: existing.id },
                    data: {
                        ...userData,
                        password_hash,
                        deleted_at: null,
                        is_active: true
                    }
                });
                return res.status(201).json(reactivatedUser);
            } else {
                return res.status(400).json({ message: 'Email already exists' });
            }
        }

        const { password, ...userData } = data;
        const password_hash = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                ...userData,
                password_hash,
            },
        });

        res.status(201).json(user);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input', errors: error.issues });
        }
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
            include: { role: true, library: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Librarian Scope Check
        if (currentRole === 'librarian') {
            const isAssigned = user.library_id === currentUser.library_id;
            const isOwned = user.library?.owner_id === currentUser.id;

            if (!isAssigned && !isOwned) return res.status(403).json({ message: 'Forbidden' });
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

        const data = updateUserSchema.parse(req.body);

        // Fetch User to check ownership
        const targetUser = await prisma.user.findUnique({ where: { id }, include: { library: true } });
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Librarian Scope Check
        // Librarian Scope Check
        if (currentRole === 'librarian') {
            const isAssigned = targetUser.library_id === currentUser.library_id;
            const isOwned = targetUser.library?.owner_id === currentUser.id;

            if (!isAssigned && !isOwned) return res.status(403).json({ message: 'Forbidden' });
        }

        let updateData: any = { ...data };
        if (data.password) {
            updateData.password_hash = await hashPassword(data.password);
            delete updateData.password;
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error updating user' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const currentUser = (req as any).user;
        const currentRole = currentUser.role.role_name;

        // Fetch User to check ownership
        const targetUser = await prisma.user.findUnique({ where: { id }, include: { library: true } });
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Librarian Scope Check
        // Librarian Scope Check
        if (currentRole === 'librarian') {
            const isAssigned = targetUser.library_id === currentUser.library_id;
            const isOwned = targetUser.library?.owner_id === currentUser.id;

            if (!isAssigned && !isOwned) return res.status(403).json({ message: 'Forbidden' });
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
