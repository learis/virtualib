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
        const role = user.role.role_name;

        let where: any = {
            returned_at: null // Only active loans (default behavior, though 'active' status is preferred check now?)
            // Original code had returned_at: null. Keep it.
        };

        if (role === 'admin') {
            // Admin sees all (per prompt request for "visibility over ALL")
            // Remove library_id constraint if you want global view.
            // Or keep user.library_id if they are bound. 
            // Prompt says: "Admin ... visibility over ALL libraries".
            // So we do NOT filter by library_id for admin anymore.
        } else if (role === 'librarian') {
            // Librarian sees loans for books in libraries they own
            where = {
                ...where,
                book: { library: { owner_id: user.id } }
            };
        } else {
            // Normal User
            where = {
                ...where,
                user_id: user.id,
                library_id: user.library_id
            };
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

        // Verify Book belongs to a library the Librarian owns (if Librarian)
        if (user.role.role_name === 'librarian') {
            const book = await prisma.book.findUnique({ where: { id: book_id }, include: { library: true } });
            if (book?.library?.owner_id !== user.id) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

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

        // Determine library_id for the loan
        // If user is User, use their library_id.
        // If Librarian creating loan, use Book's library_id? 
        // Loan model requires library_id.
        // We should fetch book's library_id to be safe.
        const book = await prisma.book.findUnique({ where: { id: book_id } });
        if (!book) return res.status(404).json({ message: 'Book not found' });

        const loan = await prisma.bookLoan.create({
            data: {
                library_id: book.library_id, // Use Book's library since User might not have one (if managed by Librarian?) actually User must have one basically.
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
        if (!loan) return res.status(404).json({ message: 'Loan not found' });

        // User must own the loan
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

// Admin/Librarian approves return
export const approveReturn = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;
        const role = user.role.role_name;

        const loan = await prisma.bookLoan.findUnique({ where: { id }, include: { book: { include: { library: true } } } });
        if (!loan) return res.status(404).json({ message: 'Loan not found' });

        // Multi-tenancy check
        if (role === 'librarian') {
            if (loan.book.library.owner_id !== user.id) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }
        // Admin can approve any

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

// Admin/Librarian rejects return
export const rejectReturn = async (req: Request, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const user = (req as any).user;
        const role = user.role.role_name;

        const loan = await prisma.bookLoan.findUnique({ where: { id }, include: { book: { include: { library: true } } } });
        if (!loan) return res.status(404).json({ message: 'Loan not found' });

        // Multi-tenancy check
        if (role === 'librarian') {
            if (loan.book.library.owner_id !== user.id) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        if (loan.status !== 'return_requested') {
            return res.status(400).json({ message: 'Loan is not pending return' });
        }

        const updatedLoan = await prisma.bookLoan.update({
            where: { id },
            data: { status: 'return_rejected' }
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
