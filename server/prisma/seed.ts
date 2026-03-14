import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const roles = ['user', 'librarian', 'admin'];

    const adminPassword = await import('bcryptjs').then(m => m.hash('admin123', 10));
    await prisma.user.upsert({
        where: { email: 'admin@virtualib.com' },
        update: {
            password_hash: adminPassword // FORCE UPDATE PASSWORD
        },
        create: {
            email: 'admin@virtualib.com',
            name: 'Admin',
            surname: 'User',
            password_hash: adminPassword,
            role: {
                connect: { role_name: 'admin' }
            }
        },
    });

    for (const roleName of roles) {
        const role = await prisma.role.upsert({
            where: { role_name: roleName },
            update: {},
            create: {
                role_name: roleName,
            },
        });
        console.log(`Role created/exists: ${role.role_name}`);
    }

    // Create Default Library
    // Cleanup: Remove invalid ID library if exists
    await prisma.library.deleteMany({ where: { id: '11111111-1111-1111-1111-111111111111' } });

    // 1111... was invalid UUID (incorrect variant bits), causing specific validations to fail.
    // Using a valid UUIDv4:
    const validLibraryId = '11111111-1111-4111-8111-111111111111';

    const library = await prisma.library.upsert({
        where: { id: validLibraryId }, // Use a fixed UUID for the seed
        update: {},
        create: {
            id: validLibraryId,
            name: 'Central Library',
            description: 'The main library of Virtualib.',
        }
    });
    console.log(`Library created/exists: ${library.name}`);

    // Create Librarian User
    const librarianRole = await prisma.role.findUnique({ where: { role_name: 'librarian' } });
    if (librarianRole) {
        const libPassword = await import('bcryptjs').then(m => m.hash('librarian123', 10));
        await prisma.user.upsert({
            where: { email: 'librarian@virtualib.com' },
            update: {
                password_hash: libPassword, // Force update
                owned_libraries: {
                    connect: { id: library.id }
                }
            },
            create: {
                email: 'librarian@virtualib.com',
                name: 'Librarian',
                surname: 'User',
                password_hash: libPassword,
                role: { connect: { id: librarianRole.id } },
                is_verified: true,
                is_active: true,
                owned_libraries: {
                    connect: { id: library.id }
                }
            }
        });
        console.log('Librarian user created/exists: librarian@virtualib.com');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
