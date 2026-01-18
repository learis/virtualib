import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching roles' });
    }
};
