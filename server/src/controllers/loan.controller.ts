import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const createLoanSchema = z.object({
    book_id: z.string().uuid(),
    user_id: z.string().uuid(),
    due_date: z.string().datetime(), // Expect ISO string
});

export const getLoans = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const isAdmin = user.role.role_name === 'admin';

        const where: any = {
            library_id: user.library_id,
            returned_at: null // Only active loans
        };

        if (!isAdmin) {
            where.user_id = user.id;
        }

        const loans = await prisma.bookLoan.findMany({
            where,
            include: {
                book: true,
                user: true
            },
            orderBy: { borrowed_at: 'desc' }
        });
        res.json(loans);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch loans' });
    }
};

export const createLoan = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const validation = createLoanSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid input', errors: validation.error.issues });
        }

        const { book_id, user_id, due_date } = validation.data;

        // Check if book is already borrowed (active loan)
        const activeLoan = await prisma.bookLoan.findFirst({
            where: {
                book_id,
                returned_at: null
            }
        });

        if (activeLoan) {
            return res.status(400).json({ message: 'Book is already on loan' });
        }

        const loan = await prisma.bookLoan.create({
            data: {
                library_id: user.library_id,
                book_id,
                user_id,
                due_at: due_date,
                status: 'active'
            }
        });

        res.status(201).json(loan);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create loan' });
    }
};

// User requests return
export const requestReturn = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;

        const loan = await prisma.bookLoan.findUnique({ where: { id } });
        if (!loan || loan.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        if (loan.user_id !== user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (loan.returned_at) {
            return res.status(400).json({ message: 'Book already returned' });
        }

        const updatedLoan = await prisma.bookLoan.update({
            where: { id },
            data: { status: 'return_requested' }
        });

        res.json(updatedLoan);
    } catch (error) {
        res.status(500).json({ message: 'Failed to request return' });
    }
};

// Admin approves return
export const approveReturn = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;

        const loan = await prisma.bookLoan.findUnique({ where: { id } });
        if (!loan || loan.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        if (loan.returned_at) {
            return res.status(400).json({ message: 'Book already returned' });
        }

        const updatedLoan = await prisma.bookLoan.update({
            where: { id },
            data: {
                returned_at: new Date(),
                status: 'returned'
            }
        });

        res.json(updatedLoan);
    } catch (error) {
        res.status(500).json({ message: 'Failed to return book' });
    }
};

// Admin rejects return
export const rejectReturn = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;

        const loan = await prisma.bookLoan.findUnique({ where: { id } });
        if (!loan || loan.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        if (loan.status !== 'return_requested') {
            return res.status(400).json({ message: 'Loan is not pending return' });
        }

        const updatedLoan = await prisma.bookLoan.update({
            where: { id },
            data: { status: 'active' }
        });

        res.json(updatedLoan);
    } catch (error) {
        res.status(500).json({ message: 'Failed to reject return' });
    }
};

// User cancels return request
export const cancelReturnRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;

        const loan = await prisma.bookLoan.findUnique({ where: { id } });
        if (!loan || loan.library_id !== user.library_id) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        if (loan.user_id !== user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (loan.status !== 'return_requested') {
            return res.status(400).json({ message: 'No active return request' });
        }

        const updatedLoan = await prisma.bookLoan.update({
            where: { id },
            data: { status: 'active' }
        });

        res.json(updatedLoan);
    } catch (error) {
        res.status(500).json({ message: 'Failed to cancel request' });
    }
};
