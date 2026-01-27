import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const updateSettingsSchema = z.object({
    smtp_host: z.string().nullable().optional(),
    smtp_port: z.number().int().nullable().optional(),
    smtp_user: z.string().nullable().optional(),
    smtp_password: z.string().nullable().optional(),
    smtp_from: z.string().email().nullable().optional().or(z.literal('')),
    // Gmail Fields
    email_provider: z.enum(['smtp', 'gmail']).default('smtp'),
    gmail_user: z.string().email().nullable().optional(),
    gmail_client_id: z.string().nullable().optional(),
    gmail_client_secret: z.string().nullable().optional(),
    gmail_refresh_token: z.string().nullable().optional(),

    reminder_rules: z.any().optional(), // Flexible JSON
    email_templates: z.any().optional(),
    overdue_days: z.number().int().optional(),
});

export const getSettings = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const role = user.role?.role_name;

        let libraryId = null;

        if (role === 'admin' || role === 'librarian') {
            // For simplicity in this refactor, we default to the first owned library (librarian) or just first library (admin)
            // In a real multi-tenancy app, we might need a 'current_context' library_id from headers.
            // But let's look for settings for ANY of the user's libraries.
            const userWithLibs = await prisma.user.findUnique({ where: { id: user.id }, include: { libraries: true } });
            const firstLibIdx = userWithLibs?.libraries[0]?.id;

            // If librarian owns libraries, check those too
            if (role === 'librarian') {
                const owned = await prisma.library.findFirst({ where: { owner_id: user.id } });
                libraryId = owned?.id || firstLibIdx;
            } else {
                libraryId = firstLibIdx;
            }
        } else {
            // Standard User
            const userWithLibs = await prisma.user.findUnique({ where: { id: user.id }, include: { libraries: true } });
            libraryId = userWithLibs?.libraries[0]?.id;
        }


        const settings = await prisma.settings.findFirst({
            where: {
                library_id: libraryId ? libraryId : undefined
            }
        });

        if (!settings) {
            // Should exist due to auto-creation on library create, but defensive fallback:
            return res.status(404).json({ message: 'Settings not found' });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch settings' });
    }
};

export const updateSettings = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const validation = updateSettingsSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ message: 'Invalid input', errors: validation.error.issues });
        }

        // Context Resolution: Which library settings to update?
        // Assuming single-tenant context for now based on user's primary association.
        // A robust solution would pass 'X-Library-ID' header or body param.
        // For MVP refactor compatibility:
        let libraryId = null;
        if (user.role.role_name === 'librarian') {
            const owned = await prisma.library.findFirst({ where: { owner_id: user.id } });
            libraryId = owned?.id;
        } else {
            const userWithLibs = await prisma.user.findUnique({ where: { id: user.id }, include: { libraries: true } });
            libraryId = userWithLibs?.libraries[0]?.id;
        }

        if (!libraryId) return res.status(400).json({ message: 'No library associated with user context' });


        // Check if settings exist for this library
        const existingSettings = await prisma.settings.findFirst({
            where: { library_id: libraryId }
        });

        let settings;
        if (existingSettings) {
            console.log('Updating settings for ID:', existingSettings.id);
            settings = await prisma.settings.update({
                where: { id: existingSettings.id },
                data: validation.data
            });
        } else {
            console.log('Creating new settings for Library:', libraryId);
            settings = await prisma.settings.create({
                data: {
                    library_id: libraryId,
                    ...validation.data
                }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Update settings detailed error:', error);
        res.status(500).json({ message: 'Failed to update settings', error: String(error) });
    }
};

export const sendTestEmail = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, to_email, email_templates } = req.body;

        if (!to_email) {
            return res.status(400).json({ message: 'Recipient email (to_email) is required' });
        }

        let subject = 'Test Email from Biblionia';
        let html = undefined;

        if (email_templates?.overdue) {
            const template = email_templates.overdue;

            // Helper for mock replacement
            const replaceMockVariables = (text: string) => text
                .replace(/{user}/g, 'Test User')
                .replace(/{book}/g, 'The Great Gatsby')
                .replace(/{author}/g, 'F. Scott Fitzgerald')
                .replace(/{publisher}/g, 'Scribner')
                .replace(/{date}/g, new Date().toLocaleDateString())
                .replace(/{borrow_date}/g, new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString()) // 5 days ago
                .replace(/{days_late}/g, '2');

            subject = replaceMockVariables(template.subject || subject);

            if (template.body) {
                html = replaceMockVariables(template.body)
                    .replace(/\n/g, '<br/>'); // Simple newline to break conversion

                // Wrap in the standard container styling
                html = `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        ${html}
                        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
                        <p style="font-size: 12px; color: #666;">This is a test render of your "Overdue Warning" template.</p>
                    </div>
                `;
            }
        }

        const { sendTestEmailDirect } = await import('../services/email.service');
        const result = await sendTestEmailDirect({
            provider: (req.body.email_provider || 'smtp') as any,
            host: smtp_host,
            port: smtp_port,
            user: smtp_user,
            pass: smtp_pass,
            from: smtp_from,
            // Gmail
            gmail_user: req.body.gmail_user,
            gmail_client_id: req.body.gmail_client_id,
            gmail_client_secret: req.body.gmail_client_secret,
            gmail_refresh_token: req.body.gmail_refresh_token,
        }, to_email, { subject, html });

        if (result.success) {
            res.json({ message: 'Test email sent successfully!' });
        } else {
            res.status(400).json({ message: 'Failed to send test email', error: result.error });
        }
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ message: 'Internal server error while sending test email' });
    }
};
