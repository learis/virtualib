import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

export const sendEmail = async (libraryId: string, options: EmailOptions) => {
    try {
        const settings = await prisma.settings.findFirst({
            where: { library_id: libraryId }
        });

        if (!settings || !settings.smtp_host || !settings.smtp_user) {
            console.warn(`SMTP settings not configured for library ${libraryId}`);
            return false;
        }

        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port || 587,
            secure: settings.smtp_port === 465, // true for 465, false for other ports
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_password || undefined,
            },
        });

        await transporter.sendMail({
            from: settings.smtp_from || settings.smtp_user,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });

        console.log(`Email sent to ${options.to}`);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
};

export const sendTestEmailDirect = async (config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
}, to: string, options?: { subject?: string; html?: string }) => {
    try {
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });

        await transporter.verify();

        await transporter.sendMail({
            from: config.from || config.user,
            to: to,
            subject: options?.subject || 'Test Email from Biblionia',
            html: options?.html || `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #4F46E5;">It works! 🎉</h2>
                    <p>This is a test email to verify your SMTP settings in Biblionia.</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    <p>If you received this, your configuration is correct.</p>
                </div>
            `,
        });

        return { success: true };
    } catch (error: any) {
        console.error('Test email failed:', error);
        return { success: false, error: error.message };
    }
};
