import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import prisma from '../lib/prisma';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

const createGmailClient = (clientId: string, clientSecret: string, refreshToken: string) => {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    return oAuth2Client;
};

const makeBody = (to: string, from: string, subject: string, message: string) => {
    const str = [
        `To: ${to}`,
        `From: ${from}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        message
    ].join('\n');

    return Buffer.from(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const sendEmail = async (libraryId: string, options: EmailOptions) => {
    try {
        const settings = await prisma.settings.findFirst({
            where: { library_id: libraryId }
        });

        // 1. Try Settings (Library Specific)
        if (settings && settings.email_provider === 'gmail') {
            if (settings.gmail_client_id && settings.gmail_client_secret && settings.gmail_refresh_token && settings.gmail_user) {
                const auth = createGmailClient(settings.gmail_client_id, settings.gmail_client_secret, settings.gmail_refresh_token);
                const gmail = google.gmail({ version: 'v1', auth });
                const raw = makeBody(options.to, settings.gmail_user, options.subject, options.html);
                await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
                console.log(`Email sent to ${options.to} via Gmail API (Library Settings)`);
                return true;
            }
        }

        // 2. Fallback to System Env (Global Gmail)
        if (process.env.GMAIL_USER && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
            const auth = createGmailClient(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REFRESH_TOKEN);
            const gmail = google.gmail({ version: 'v1', auth });
            const raw = makeBody(options.to, process.env.GMAIL_USER, options.subject, options.html);
            await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
            console.log(`Email sent to ${options.to} via Gmail API (System Env)`);
            return true;
        }

        // 3. Fallback to Settings SMTP
        if (settings && settings.smtp_host && settings.smtp_user) {
            // ... existing SMTP logic ...
            const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: settings.smtp_port || 587,
                secure: settings.smtp_port === 465,
                auth: { user: settings.smtp_user, pass: settings.smtp_password || undefined },
            });
            await transporter.sendMail({
                from: settings.smtp_from || settings.smtp_user,
                to: options.to,
                subject: options.subject,
                html: options.html,
            });
            console.log(`Email sent to ${options.to} via SMTP`);
            return true;
        }

        console.warn(`No valid email configuration found for library ${libraryId} or system.`);
        return false;


    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
};

export const sendTestEmailDirect = async (config: {
    provider: 'smtp' | 'gmail';
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
    // Gmail specific
    gmail_user?: string;
    gmail_client_id?: string;
    gmail_client_secret?: string;
    gmail_refresh_token?: string;
}, to: string, options?: { subject?: string; html?: string }) => {
    try {
        const subject = options?.subject || 'Test Email from Virtualib';
        const html = options?.html || `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #4F46E5;">It works! 🎉</h2>
                <p>This is a test email to verify your settings in Virtualib.</p>
                <p><strong>Provider:</strong> ${config.provider.toUpperCase()}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
        `;

        // GMAIL API TEST
        if (config.provider === 'gmail') {
            if (!config.gmail_client_id || !config.gmail_client_secret || !config.gmail_refresh_token || !config.gmail_user) {
                throw new Error("Missing Gmail credentials");
            }

            const auth = createGmailClient(config.gmail_client_id, config.gmail_client_secret, config.gmail_refresh_token);
            const gmail = google.gmail({ version: 'v1', auth });

            const raw = makeBody(to, config.gmail_user, subject, html);

            await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw }
            });

            return { success: true };
        }

        // SMTP TEST
        if (!config.host || !config.user || !config.pass) throw new Error("Missing SMTP credentials");

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: config.pass,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.verify();

        await transporter.sendMail({
            from: config.from || config.user,
            to: to,
            subject,
            html,
        });

        return { success: true };
    } catch (error: any) {
        console.error('Test email failed DETAILED:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

        let errorMessage = error.message || String(error);

        // Friendly error mapping
        if (JSON.stringify(error).includes('invalid_grant')) {
            errorMessage = 'Gmail Yetkilendirme Hatası (invalid_grant): Refresh Token geçersiz veya süresi dolmuş. Lütfen token\'ı yenileyin veya Google Cloud Console üzerinden uygulamanızı "Publish" moduna alın.';
        } else if (errorMessage.includes('Missing credentials')) {
            errorMessage = 'Eksik Kimlik Bilgileri: Lütfen tüm alanları doldurduğunuzdan emin olun.';
        } else if (errorMessage.includes('ETIMEDOUT')) {
            errorMessage = 'Bağlantı Zaman Aşımı: Sunucuya ulaşılamadı. Port ve Host ayarlarını kontrol edin.';
        } else if (errorMessage.includes('EAUTH')) {
            errorMessage = 'Kimlik Doğrulama Hatası: Kullanıcı adı veya şifre yanlış. Gmail için "Uygulama Şifresi" (App Password) kullandığınızdan emin olun.';
        }

        return { success: false, error: errorMessage };
    }
};
