import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { comparePassword, generateToken } from '../utils/auth';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';

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
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleLoginSchema = z.object({
    idToken: z.string()
});

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { idToken } = googleLoginSchema.parse(req.body);

        // Verify Google Token
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            return res.status(400).json({ message: 'Invalid Google Token' });
        }

        const { email, given_name, family_name, picture } = payload;

        // Check internal DB
        let user = await prisma.user.findUnique({
            where: { email },
            include: { role: true, libraries: true }
        });

        if (user) {
            // User exists.
            // If they were a "Ghost" (unverified email registration) OR explicitly "EMAIL_INVITE", we verify them now.
            if ((!user.is_verified && user.registration_method === 'EMAIL') || user.registration_method === 'EMAIL_INVITE') {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        is_verified: true,
                        is_active: true, // Activate account
                        registration_method: 'GOOGLE', // Upgrade to Google
                        name: given_name || user.name, // Update name if provided/better
                        surname: family_name || user.surname,
                        // Optional: Update picture if we store it
                    },
                    include: { role: true, libraries: true }
                });
            }
        } else {
            // New User Registration
            // By default, assign 'user' role
            const userRole = await prisma.role.findUnique({ where: { role_name: 'user' } });
            if (!userRole) throw new Error("Default role 'user' not found");

            user = await prisma.user.create({
                data: {
                    email,
                    name: given_name || 'Unknown',
                    surname: family_name || '',
                    role_id: userRole.id,
                    password_hash: '', // No password for Google users
                    registration_method: 'GOOGLE',
                    is_verified: true,
                    is_active: true
                },
                include: { role: true, libraries: true }
            });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'Account disabled' });
        }

        // Generate Session Token
        const token = generateToken({ userId: user.id, role: user.role.role_name });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role.role_name,
                libraries: user.libraries.map(l => ({ id: l.id, name: l.name })),
                plan: user.plan // Return plan info
            },
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input', errors: error.issues });
        }
        console.error('Google Login Error:', error);
        res.status(500).json({ message: 'Google authentication failed' });
    }
};
