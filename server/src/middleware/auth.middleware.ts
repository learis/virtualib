import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { verifyToken } from '../utils/auth';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = verifyToken(token) as { userId: string };
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                role: true,
                libraries: true
            },
        });

        if (!user || !user.is_active) {
            // DEBUG: Changed to 403
            return res.status(403).json({ message: 'Unauthorized: User not found or inactive' });
        }

        (req as any).user = user;
        next();
    } catch (error) {
        // DEBUG: Changed to 403
        return res.status(403).json({ message: 'Unauthorized: Invalid token' });
    }
};

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!(req as any).user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!roles.includes((req as any).user.role.role_name)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};

export const enforceLibraryScope = (req: Request, res: Response, next: NextFunction) => {
    // If user is admin, they might be accessing cross-library (handled by route logic usually),
    // but for basic scope enforcement:
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // If request has library_id in params or body, check if match
    // OR strictly inject filter into request object for controllers to use

    // Requirement: "All library scoping must be enforced at backend level"
    // For Users: they generally only see their own library.
    // For Admins: they can see all.

    // Implementation strategy: 
    // Controllers should use `req.user.library_id` to filter data if user is NOT admin.
    // If user IS admin, they might specify a library_id query param or header to switch context, 
    // or see all.

    next();
};
