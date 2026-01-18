import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const libraryId = user.library_id;

        // Run queries in parallel for performance
        const [
            totalBooks,
            totalUsers,
            activeLoans,
            pendingRequests,
            totalLoans,
            acceptedRequests,
            rejectedRequests,
            totalLibraries,
            totalCategories,
            booksByCategory,
            bookCategories,
            recentRequests
        ] = await Promise.all([
            // 1. Total Books
            prisma.book.count({ where: { library_id: libraryId } }),
            // 2. Total Users
            prisma.user.count({ where: { library_id: libraryId } }),
            // 3. Active Loans (returned_at is null)
            prisma.bookLoan.count({ where: { library_id: libraryId, returned_at: null } }),
            // 4. Pending Requests
            prisma.borrowRequest.count({ where: { library_id: libraryId, status: 'pending' } }),
            // 5. Total Loans (All time)
            prisma.bookLoan.count({ where: { library_id: libraryId } }),
            // 6. Accepted Requests
            prisma.borrowRequest.count({ where: { library_id: libraryId, status: 'approved' } }),
            // 7. Rejected Requests
            prisma.borrowRequest.count({ where: { library_id: libraryId, status: 'rejected' } }),
            // 8. Total Libraries (System wide, for context, or just this one? Assuming system wide probably not useful here, sticking to 1 for tenant. But user asked for total libraries. If detailed, maybe system wide. But usually tenant locked. I will query all if admin, but schema is multi-tenant? No, just fields. I'll just count all for now as requested or count 1. Wait, user asked for "Total Library Count". I'll count all in DB if superadmin? But current auth is simple. I'll just count all.)
            prisma.library.count(),
            // 9. Total Categories
            prisma.category.count({ where: { library_id: libraryId } }),
            // 10. Books by Category (Grouped)
            prisma.bookCategory.groupBy({
                by: ['category_id'],
                _count: { book_id: true }
            }),
            // 11. Fetch Category Names for mapping
            prisma.category.findMany({ where: { library_id: libraryId }, select: { id: true, name: true } }),

            // 12. Recent Borrow Requests (for the list)
            prisma.borrowRequest.findMany({
                where: { library_id: libraryId },
                orderBy: { requested_at: 'desc' },
                take: 5,
                include: {
                    user: { select: { name: true, surname: true, email: true } },
                    book: { select: { name: true, author: true } }
                }
            })
        ]);

        // Process Books by Category
        const booksByCategoryData = booksByCategory.map(item => {
            const cat = bookCategories.find(c => c.id === item.category_id);
            return {
                name: cat?.name || 'Unknown',
                value: item._count.book_id
            };
        });

        // 13. Popular Books (Most borrowed)
        const popularBooksGrouped = await prisma.bookLoan.groupBy({
            by: ['book_id'],
            where: { library_id: libraryId },
            _count: { book_id: true },
            orderBy: { _count: { book_id: 'desc' } },
            take: 5
        });

        const popularBookIds = popularBooksGrouped.map(item => item.book_id);
        const popularBooksDetails = await prisma.book.findMany({
            where: { id: { in: popularBookIds } },
            select: { id: true, name: true, author: true, cover_image_path: true }
        });

        const popularBooks = popularBooksGrouped.map(item => {
            const details = popularBooksDetails.find(b => b.id === item.book_id);
            return {
                ...details,
                loan_count: item._count.book_id
            };
        });

        res.json({
            totalBooks,
            totalUsers,
            activeLoans,
            pendingRequests,
            totalLoans,
            acceptedRequests,
            rejectedRequests,
            totalLibraries,
            totalCategories,
            recentRequests,
            popularBooks,
            booksByCategory: booksByCategoryData
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
};
