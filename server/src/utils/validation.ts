import prisma from '../lib/prisma';

export const validateLibraryOwnership = async (userId: string, libraryId: string): Promise<boolean> => {
    // Admins own everything effectively (or bypass check)
    // But this function is specifically to check if a Librarian owns the target library.

    // Check if library belongs to user
    const library = await prisma.library.findUnique({
        where: { id: libraryId }
    });

    if (!library) return false;
    return library.owner_id === userId;
};
