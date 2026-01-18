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
    library_id: z.string().uuid(),
    password: z.string().min(6),
});

export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { deleted_at: null }, // Soft delete filter
            include: { role: true, library: true },
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const data = createUserSchema.parse(req.body);

        // Check if email unique
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            return res.status(400).json({ message: 'Email already exists' });
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
        const user = await prisma.user.findUnique({
            where: { id },
            include: { role: true, library: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user' });
    }
};

const updateUserSchema = createUserSchema.partial();

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const data = updateUserSchema.parse(req.body);

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
