import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const createRequestSchema = z.object({
    book_id: z.string().uuid(),
});

const updateRequestStatusSchema = z.object({
    status: z.enum(['approved', 'rejected']),
});

export const getRequests = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const isAdmin = user.role.role_name === 'admin';

        const where: any = { library_id: user.library_id };
        if (!isAdmin) {
            where.user_id = user.id;
        }

        // 1. Fetch Borrow Requests (All statuses)
        const borrowRequests = await prisma.borrowRequest.findMany({
            where: {
                ...where
                // Removed status: 'pending' to show history
            },
            include: {
                book: true,
                user: true
            },
            orderBy: { requested_at: 'desc' }
        });

        // 2. Fetch Return Requests (Loans with status 'return_requested')
        const returnRequests = await prisma.bookLoan.findMany({
            where: {
                ...where,
                status: { in: ['return_requested', 'returned', 'return_rejected'] }
            },
            include: {
                book: true,
                user: true
            },
            orderBy: { borrowed_at: 'desc' }
        });

        // 3. Unify
        const unifiedRequests = [
            ...borrowRequests.map(r => ({
                id: r.id,
                type: 'borrow',
                book: r.book,
                user: r.user,
                status: r.status,
                date: r.requested_at
            })),
            ...returnRequests.map(r => ({
                id: r.id,
                type: 'return',
                book: r.book,
                user: r.user,
                status: r.status, // 'return_requested'
                date: r.updated_at // Correctly reflects when the return was requested
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        res.json(unifiedRequests);
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ message: 'Failed to fetch requests' });
    }
};

export const createRequest = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const validation = createRequestSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid input', errors: validation.error.issues });
        }

        const { book_id } = validation.data;

        // Check if book is already borrowed
        const activeLoan = await prisma.bookLoan.findFirst({
            where: { book_id, returned_at: null }
        });
        if (activeLoan) {
            return res.status(400).json({ message: 'Book is currently unavailable (on loan)' });
        }

        // Check for existing pending request
        const existingRequest = await prisma.borrowRequest.findFirst({
            where: {
                book_id,
                user_id: user.id,
                status: 'pending'
            }
        });
        if (existingRequest) {
            return res.status(400).json({ message: 'You already requested this book' });
        }

        const request = await prisma.borrowRequest.create({
            data: {
                library_id: user.library_id,
                book_id,
                user_id: user.id,
                status: 'pending'
            }
        });
        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create request' });
    }
};

export const updateRequestStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;
        const validation = updateRequestStatusSchema.safeParse(req.body);

        if (!validation.success) return res.status(400).json({ message: 'Invalid status' });
        const { status } = validation.data;

        const request = await prisma.borrowRequest.findUnique({ where: { id } });
        if (!request || request.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request is already decided' });
        }

        const updatedRequest = await prisma.$transaction(async (tx) => {
            const reqUpdate = await tx.borrowRequest.update({
                where: { id },
                data: {
                    status,
                    decided_at: new Date()
                }
            });

            if (status === 'approved') {
                // Double check availability
                const activeLoan = await tx.bookLoan.findFirst({
                    where: { book_id: request.book_id, returned_at: null }
                });
                if (activeLoan) throw new Error('Book is currently on loan');

                // Fetch settings for loan duration
                const settings = await tx.settings.findFirst({
                    where: { library_id: request.library_id }
                });

                const loanDuration = settings?.overdue_days || 14;

                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + loanDuration);

                await tx.bookLoan.create({
                    data: {
                        library_id: request.library_id,
                        book_id: request.book_id,
                        user_id: request.user_id,
                        due_at: dueDate
                    }
                });
            }
            return reqUpdate;
        });

        res.json(updatedRequest);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to update request' });
    }
};
