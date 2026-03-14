import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { hashPassword } from '../utils/auth';
import { sendEmail } from '../services/email.service';
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

const inviteUserSchema = z.object({
    email: z.string().email(),
    library_ids: z.array(z.string().uuid()),
    role_id: z.string().uuid().optional(),
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
                // OR have an invitation to one of these libraries
                where.OR = [
                    {
                        libraries: {
                            some: {
                                id: { in: allowedIds }
                            }
                        }
                    },
                    {
                        invitations: {
                            some: {
                                library_id: { in: allowedIds }
                            }
                        }
                    }
                ];
            } else {
                return res.json([]);
            }
        }

        const users = await prisma.user.findMany({
            where,
            include: { role: true, libraries: true, invitations: true }, // Include libraries & invitations
        });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};



export const createUserInvitation = async (req: Request, res: Response) => {
    try {
        console.log('[CreateInvitation] Body:', JSON.stringify(req.body, null, 2));
        const currentUser = (req as any).user;
        const currentRole = currentUser.role.role_name;

        const data = inviteUserSchema.parse(req.body);

        // 1. Librarian Scope Check
        if (currentRole === 'librarian') {
            const ownedLibs = await prisma.library.findMany({
                where: { owner_id: currentUser.id },
                select: { id: true }
            });
            const ownedIds = ownedLibs.map(l => l.id);
            
            const userWithLibs = await prisma.user.findUnique({
                where: { id: currentUser.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];
            
            const allowedIds = [...new Set([...ownedIds, ...assignedIds])];
            
            const allAllowed = data.library_ids.every(id => allowedIds.includes(id));
            if (!allAllowed) {
                return res.status(403).json({ message: 'Forbidden: You can only invite users to libraries you manage' });
            }
        }

        // 2. Check or Create User (Ghost)
        let user = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (!user) {
            let roleToAssign;
            if (data.role_id && currentRole === 'admin') {
               roleToAssign = data.role_id;
            } else {
               const userRole = await prisma.role.findUnique({ where: { role_name: 'user' } });
               roleToAssign = userRole!.id;
            }

            user = await prisma.user.create({
                data: {
                    email: data.email,
                    name: '',
                    surname: '',
                    password_hash: '',
                    role_id: roleToAssign,
                    registration_method: 'EMAIL_INVITE',
                    is_verified: false,
                    is_active: false,
                }
            });
        }

        // 3. Create Invitations
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 48);

        const targetLibraries = await prisma.library.findMany({
            where: { id: { in: data.library_ids } },
            select: { id: true, name: true }
        });

        // We'll collect links for the email
        const invitationLinks: { libName: string, accept: string, reject: string }[] = [];

        for (const lib of targetLibraries) {
            // Check if already invited or member?
            // Member check:
            const isMember = await prisma.user.findFirst({
                where: { id: user.id, libraries: { some: { id: lib.id } } }
            });
            if (isMember) continue; // Skip if already member

            // Invitation check:
            const existingInv = await prisma.invitation.findFirst({
                where: { email: user.email, library_id: lib.id, status: 'PENDING' }
            });

            let invId = existingInv?.id;

            if (!existingInv) {
                const inv = await prisma.invitation.create({
                    data: {
                        email: user.email,
                        library_id: lib.id,
                        sender_id: currentUser.id,
                        status: 'PENDING',
                        expires_at: expiryDate
                    }
                });
                invId = inv.id;
            } else {
                // Update expiry if re-inviting? Or just use existing.
                // Let's update expiry to extend it.
                await prisma.invitation.update({
                    where: { id: invId },
                    data: { expires_at: expiryDate }
                });
            }

            invitationLinks.push({
                libName: lib.name,
                accept: `${process.env.CLIENT_URL || 'http://localhost:8080'}/invitations?token=${invId}&action=accept`,
                reject: `${process.env.CLIENT_URL || 'http://localhost:8080'}/invitations?token=${invId}&action=reject`
            });
        }

        if (invitationLinks.length === 0) {
            return res.status(400).json({ message: 'User is already a member of selected libraries or pending invitation exists.' });
        }


        // 4. Send Email
        // We use the first library's settings for sending (common pattern)
        const primaryLibId = data.library_ids[0];

        const linksHtml = invitationLinks.map(link => `
            <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #eee;">
                <strong>${link.libName}</strong><br/>
                <a href="${link.accept}" style="color: green; margin-right: 10px;">Accept</a>
                <a href="${link.reject}" style="color: red;">Reject</a>
            </div>
        `).join('');

        await sendEmail(primaryLibId, {
            to: user.email,
            subject: 'Invitation to Join Virtualib',
            html: `
                <h3>Hello,</h3>
                <p>You have been invited to join the following libraries on Virtualib:</p>
                ${linksHtml}
                <p>These invitations will expire in 48 hours.</p>
                <p>If you do not have an account, you can <a href="${process.env.CLIENT_URL}/login">Register/Login</a> after accepting.</p>
            `
        });

        return res.status(201).json({ message: `Invitation sent to ${data.email}` });

    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('[CreateInvitation] Validation Error:', JSON.stringify(error.issues, null, 2));
            return res.status(400).json({ message: 'Invalid input', errors: error.issues });
        }
        console.error(error);
        res.status(500).json({ message: 'Error inviting user' });
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
        const targetUser = await prisma.user.findUnique({ where: { id }, include: { libraries: true, role: true } });
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Librarian Scope Check
        if (currentRole === 'librarian') {
            const ownedLibs = await prisma.library.findMany({ where: { owner_id: currentUser.id }, select: { id: true } });
            const ownedIds = ownedLibs.map(l => l.id);
            const isTargetInOwned = targetUser.libraries.some(lib => ownedIds.includes(lib.id));

            if (!isTargetInOwned) return res.status(403).json({ message: 'Forbidden' });

            // Ensure Librarian can only delete 'user' role
            if (targetUser.role?.role_name !== 'user') {
                return res.status(403).json({ message: 'Forbidden: Librarians can only delete regular Users' });
            }
        }

        // Hard delete
        await prisma.user.delete({
            where: { id }
        });
        res.json({ message: 'User permanently deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user' });
    }
};
