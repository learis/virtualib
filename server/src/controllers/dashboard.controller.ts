import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const role = user.role.role_name;

        // Determine Filter Context
        let whereLibrary: any = {};

        if (role === 'admin') {
            // Admin sees all, no filter
            whereLibrary = {};
        } else if (role === 'librarian') {
            // Librarian sees data for libraries they own
            whereLibrary = { library: { owner_id: user.id } };
        } else {
            // User sees data for their library only
            whereLibrary = { library_id: user.library_id };
        }

        // Special case for Library Count
        // Admin: All
        // Librarian: Owned
        // User: 1 (Their own)
        const libraryCountQuery = role === 'admin' ? {} : (role === 'librarian' ? { owner_id: user.id } : { id: user.library_id });

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
            prisma.book.count({ where: whereLibrary }),
            // 2. Total Users
            prisma.user.count({ where: whereLibrary }),
            // 3. Active Loans (returned_at is null)
            prisma.bookLoan.count({ where: { ...whereLibrary, returned_at: null } }),
            // 4. Pending Requests
            prisma.borrowRequest.count({ where: { ...whereLibrary, status: 'pending' } }),
            // 5. Total Loans (All time)
            prisma.bookLoan.count({ where: whereLibrary }),
            // 6. Accepted Requests
            prisma.borrowRequest.count({ where: { ...whereLibrary, status: 'approved' } }),
            // 7. Rejected Requests
            prisma.borrowRequest.count({ where: { ...whereLibrary, status: 'rejected' } }),
            // 8. Total Libraries
            prisma.library.count({ where: libraryCountQuery }),
            // 9. Total Categories
            prisma.category.count({ where: whereLibrary }),
            // 10. Books by Category (Grouped)
            // Note: groupBy with relational filter simple 'where' might not work directly if whereLibrary implies 'library' relation but groupBy is on bookCategory
            // BookCategory has 'category_id' and 'book_id'.
            // Actually this query was: prisma.bookCategory.groupBy...
            // It needs filtering by libraries the books belong to. 
            // Prisma groupBy doesn't support deep relation filtering easily in early versions, but we can try count if needed.
            // Or fetch all categories for the Librarian and count books in them.
            // Simplified approach: Fetch all categories for the scope, then count books.
            // For now, let's try to adapt the existing query if possible.
            // The original was: prisma.bookCategory.groupBy... where: { category: { library_id: ... } } ? No, original was { category: ... }?
            // Original: prisma.bookCategory.groupBy({ by: ['category_id'], _count: { book_id: true } }) - It had NO filter in original code!
            // Wait, previous code: count({ where: { library_id: libraryId } }) was for categories.
            // The groupBy had NO where clause in the original code? 
            // Original line 43: prisma.bookCategory.groupBy({ by: ['category_id'], _count: { book_id: true } })
            // It was MISSING filtering! It counted ALL books system wide? Yes. 
            // I should fix this.
            // Properly filtering groupBy with relation is tricky.
            // Alternative: Find categories in scope, then for those categories, count books.
            prisma.category.findMany({
                where: whereLibrary,
                include: { _count: { select: { books: true } } }
            }),

            // 11. Fetch Category Names (Replaced by 10 above mostly, but kept for consistency if needed)
            // We can merge 10 and 11.
            Promise.resolve([]), // Placeholder to keep array structure

            // 12. Recent Borrow Requests
            prisma.borrowRequest.findMany({
                where: whereLibrary,
                orderBy: { requested_at: 'desc' },
                take: 5,
                include: {
                    user: { select: { name: true, surname: true, email: true } },
                    book: { select: { name: true, author: true } }
                }
            })
        ]);

        // Process Books by Category (From findMany with _count)
        // booksByCategory is now Array<Category & { _count: { books: number } }>
        const booksByCategoryData = (booksByCategory as any[]).map((cat: any) => ({
            name: cat.name,
            value: cat._count.books
        }));

        // 13. Popular Books
        // For Librarian: Filter by book.library.owner_id
        const popularBooksGrouped = await prisma.bookLoan.groupBy({
            by: ['book_id'],
            where: whereLibrary,
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
