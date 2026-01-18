import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const updateSettingsSchema = z.object({
    smtp_host: z.string().nullable().optional(),
    smtp_port: z.number().int().nullable().optional(),
    smtp_user: z.string().nullable().optional(),
    smtp_password: z.string().nullable().optional(),
    smtp_from: z.string().email().nullable().optional().or(z.literal('')),
    reminder_rules: z.any().optional(), // Flexible JSON
    email_templates: z.any().optional(),
});

export const getSettings = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const settings = await prisma.settings.findFirst({
            where: { library_id: user.library_id }
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

        // Check if settings exist for this library
        const existingSettings = await prisma.settings.findFirst({
            where: { library_id: user.library_id }
        });

        let settings;
        if (existingSettings) {
            console.log('Updating settings for ID:', existingSettings.id);
            settings = await prisma.settings.update({
                where: { id: existingSettings.id },
                data: validation.data
            });
        } else {
            console.log('Creating new settings for Library:', user.library_id);
            settings = await prisma.settings.create({
                data: {
                    library_id: user.library_id,
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
            host: smtp_host,
            port: smtp_port,
            user: smtp_user,
            pass: smtp_pass,
            from: smtp_from
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
