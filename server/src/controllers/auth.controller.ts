import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { comparePassword, generateToken } from '../utils/auth';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true, libraries: true },
        });

        if (!user || !user.is_active) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await comparePassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Role-based check: Admins are superadmins
        // We'll return the role and library info.

        const token = generateToken({ userId: user.id, role: user.role.role_name });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role.role_name,
                // library_id: user.library_id, // Deprecated
                // library_name: user.library?.name || 'Managed Library', // Deprecated
                libraries: user.libraries.map(l => ({ id: l.id, name: l.name }))
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input', errors: error.issues });
        }
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
