import prisma from '../lib/prisma';
import { hashPassword } from '../utils/auth';

const seed = async () => {
    try {
        // Roles
        const adminRole = await prisma.role.upsert({
            where: { role_name: 'admin' },
            update: {},
            create: { role_name: 'admin' },
        });

        const userRole = await prisma.role.upsert({
            where: { role_name: 'user' },
            update: {},
            create: { role_name: 'user' },
        });

        // Default Library
        const library = await prisma.library.create({
            data: {
                name: 'Main Library',
                description: 'The main library instance',
                settings: {
                    create: {
                        reminder_rules: [
                            { days: 3, message: '3 days passed' },
                            { days: 7, message: 'Overdue!' }
                        ],
                        email_templates: {
                            reminder: 'Hello ${user}, please return ${borrowed_books}.'
                        }
                    }
                }
            },
        });

        // Admin User
        const adminPassword = await hashPassword('admin123');
        await prisma.user.upsert({
            where: { email: 'admin@openlib.com' },
            update: {},
            create: {
                name: 'Admin',
                surname: 'User',
                email: 'admin@virtualib.com',
                phone: '1234567890',
                role_id: adminRole.id,
                // library_id: library.id,
                libraries: {
                    connect: [{ id: library.id }]
                },
                password_hash: adminPassword,
            },
        });

        // Librarian Role
        const librarianRole = await prisma.role.upsert({
            where: { role_name: 'librarian' },
            update: {},
            create: { role_name: 'librarian' },
        });

        // Librarian User
        const librarianPassword = await hashPassword('librarian123');
        await prisma.user.upsert({
            where: { email: 'librarian@demo.com' },
            update: {},
            create: {
                name: 'Jane',
                surname: 'Librarian',
                email: 'librarian@demo.com',
                phone: '5551234567',
                role_id: librarianRole.id,
                // library_id: null, 
                // Librarian owns libraries, doesn't necessarily need to be assigned to one as a member in traditional sense, 
                // but for our logic, if they operate solely on owned libraries, they don't need 'libraries' relation.
                // If they need to see books in libraries they don't own, we add here.
                // For now, let's keep it empty as they are owner.
                password_hash: librarianPassword,
            },
        });

        // Sample Categories
        const fiction = await prisma.category.create({
            data: { name: 'Fiction', library_id: library.id },
        });
        const science = await prisma.category.create({
            data: { name: 'Science', library_id: library.id },
        });
        const history = await prisma.category.create({
            data: { name: 'History', library_id: library.id },
        });

        // Sample Books
        await prisma.book.createMany({
            data: [
                {
                    library_id: library.id,
                    name: 'The Great Gatsby',
                    author: 'F. Scott Fitzgerald',
                    isbn: '9780743273565',
                    publish_year: 1925,
                    publisher: 'Scribner',
                    cover_image_path: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=2730&auto=format&fit=crop',
                    summary_en: 'A novel about the American dream.',
                },
                {
                    library_id: library.id,
                    name: 'A Brief History of Time',
                    author: 'Stephen Hawking',
                    isbn: '9780553380163',
                    publish_year: 1988,
                    publisher: 'Bantam Books',
                    cover_image_path: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=2787&auto=format&fit=crop',
                    summary_en: 'A book about cosmology.',
                },
                {
                    library_id: library.id,
                    name: 'Sapiens: A Brief History of Humankind',
                    author: 'Yuval Noah Harari',
                    isbn: '9780062316097',
                    publish_year: 2011,
                    publisher: 'Harper',
                    cover_image_path: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2912&auto=format&fit=crop',
                    summary_en: 'A book about the history of humankind.',
                },
                {
                    library_id: library.id,
                    name: 'Dune',
                    author: 'Frank Herbert',
                    isbn: '9780441013593',
                    publish_year: 1965,
                    publisher: 'Ace',
                    cover_image_path: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=2788&auto=format&fit=crop',
                    summary_en: 'A science fiction novel.',
                },
                {
                    library_id: library.id,
                    name: 'Atomic Habits',
                    author: 'James Clear',
                    isbn: '9780735211292',
                    publish_year: 2018,
                    publisher: 'Avery',
                    cover_image_path: 'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?q=80&w=2812&auto=format&fit=crop',
                    summary_en: 'A book about habit formation.',
                }
            ]
        });

        console.log('Seed completed successfully');
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
};

seed();
