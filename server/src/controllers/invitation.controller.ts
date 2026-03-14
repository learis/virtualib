import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { sendEmail } from '../services/email.service';

// Schema for accepting/rejecting
const respondInvitationSchema = z.object({
    token: z.string().uuid(),
});

// Schema for resend and cancel
const manageInvitationSchema = z.object({
    invitation_id: z.string().uuid(),
});

export const acceptInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = respondInvitationSchema.parse(req.body);

        const invitation = await prisma.invitation.findUnique({
            where: { id: token },
            include: { library: true, sender: true }
        });

        if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
        if (invitation.status !== 'PENDING') return res.status(400).json({ message: `Invitation is already ${invitation.status}` });
        if (invitation.expires_at < new Date()) {
            return res.status(400).json({ message: 'Invitation expired' });
        }

        // Connect User to Library
        const user = await prisma.user.findUnique({ where: { email: invitation.email } });

        if (!user) return res.status(404).json({ message: 'User not found' });

        await prisma.$transaction([
            // 1. Update Invitation
            prisma.invitation.update({
                where: { id: token },
                data: { status: 'ACCEPTED' }
            }),
            // 2. Add library to user
            prisma.user.update({
                where: { id: user.id },
                data: {
                    libraries: {
                        connect: { id: invitation.library_id }
                    }
                }
            })
        ]);

        return res.json({ message: 'Invitation accepted', library: invitation.library.name });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const rejectInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = respondInvitationSchema.parse(req.body);

        const invitation = await prisma.invitation.findUnique({
            where: { id: token }
        });

        if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
        if (invitation.status !== 'PENDING') return res.status(400).json({ message: `Invitation is already ${invitation.status}` });

        await prisma.invitation.update({
            where: { id: token },
            data: { status: 'REJECTED' } // Or CANCELED_BY_USER
        });

        return res.json({ message: 'Invitation rejected' });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const resendInvitation = async (req: Request, res: Response) => {
    try {
        const { invitation_id } = manageInvitationSchema.parse(req.params);

        const invitation = await prisma.invitation.findUnique({
            where: { id: invitation_id },
            include: { library: true }
        });

        if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
        if (invitation.status !== 'PENDING') return res.status(400).json({ message: 'Only PENDING invitations can be resent' });

        // Check if 24 hours have passed since last update/send
        const lastSent = new Date(invitation.updated_at);
        const nextAllowedResend = new Date(lastSent.getTime() + 24 * 60 * 60 * 1000);
        
        if (new Date() < nextAllowedResend) {
            return res.status(429).json({ message: 'You can only resend this invitation once per 24 hours' });
        }

        // EXTEND expiry by 48h
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 48);

        await prisma.invitation.update({
            where: { id: invitation_id },
            data: {
                status: 'PENDING',
                expires_at: newExpiry,
                // updated_at is auto-updated by prisma
            }
        });

        // Send Email Again
        const AcceptLink = `${process.env.CLIENT_URL}/invitations?token=${invitation.id}&action=accept`;
        const RejectLink = `${process.env.CLIENT_URL}/invitations?token=${invitation.id}&action=reject`;

        await sendEmail(invitation.library_id, {
            to: invitation.email,
            subject: 'Invitation Reminder: Join Virtualib',
            html: `
                <h3>Hello,</h3>
                <p>You have a pending invitation to join <strong>${invitation.library.name}</strong> on Virtualib.</p>
                <p>This invitation will expire in 48 hours.</p>
                <p>
                   <a href="${AcceptLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Accept Invitation</a>
                   <a href="${RejectLink}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject</a>
                </p>
            `
        });

        return res.json({ message: 'Invitation resent successfully' });

    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
        console.error(error);
        res.status(500).json({ message: 'Error resending invitation' });
    }
};

export const cancelInvitation = async (req: Request, res: Response) => {
    try {
        const { invitation_id } = manageInvitationSchema.parse(req.params);

        const invitation = await prisma.invitation.findUnique({
            where: { id: invitation_id }
        });

        if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
        if (invitation.status !== 'PENDING') return res.status(400).json({ message: 'Only PENDING invitations can be canceled' });

        await prisma.invitation.update({
            where: { id: invitation_id },
            data: { status: 'CANCELED_BY_USER' }
        });

        return res.json({ message: 'Invitation canceled successfully' });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
        console.error(error);
        res.status(500).json({ message: 'Error canceling invitation' });
    }
};

export const getInvitations = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const isAdmin = user.role?.role_name === 'admin';
        
        let invitations;
        
        if (isAdmin) {
            // Admins see all invitations
            invitations = await prisma.invitation.findMany({
                include: {
                    library: { select: { name: true } },
                    sender: { select: { name: true, surname: true, email: true } }
                },
                orderBy: { created_at: 'desc' }
            });
        } else {
            // Librarians see invitations for their owned AND assigned libraries
            const userWithLibs = await prisma.user.findUnique({
                where: { id: user.id },
                include: { libraries: true }
            });
            const assignedIds = userWithLibs?.libraries.map(l => l.id) || [];
            
            const ownedLibraries = await prisma.library.findMany({
                where: { owner_id: user.id },
                select: { id: true }
            });
            const ownedIds = ownedLibraries.map(l => l.id);
            
            const libraryIds = Array.from(new Set([...assignedIds, ...ownedIds]));
            
            invitations = await prisma.invitation.findMany({
                where: { library_id: { in: libraryIds } },
                include: {
                    library: { select: { name: true } },
                    sender: { select: { name: true, surname: true, email: true } }
                },
                orderBy: { created_at: 'desc' }
            });
        }

        res.json(invitations);
    } catch (error) {
        console.error('Failed to get invitations:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteInvitation = async (req: Request, res: Response) => {
    try {
        const { invitation_id } = manageInvitationSchema.parse(req.params);

        const invitation = await prisma.invitation.findUnique({
            where: { id: invitation_id }
        });

        if (!invitation) return res.status(404).json({ message: 'Invitation not found' });

        await prisma.invitation.delete({
            where: { id: invitation_id }
        });

        return res.json({ message: 'Invitation deleted successfully' });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ errors: error.issues });
        console.error(error);
        res.status(500).json({ message: 'Error deleting invitation' });
    }
};
