import cron from 'node-cron';
import prisma from '../lib/prisma';
import { sendEmail } from './email.service';

export const initCronJobs = () => {
    // Run every day at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily reminder job...');
        await checkOverdueLoans();
    });
};

const checkOverdueLoans = async () => {
    const now = new Date();

    // Find loans due today or yesterday (simple logic for now)
    const dueLoans = await prisma.bookLoan.findMany({
        where: {
            returned_at: null,
            due_at: {
                lte: now
            },
        },
        include: {
            user: true,
            book: true
        }
    });

    for (const loan of dueLoans) {
        // Simple throttling: Don't send if sent in last 24 hours
        if (loan.last_reminder_sent_at && (now.getTime() - loan.last_reminder_sent_at.getTime() < 24 * 60 * 60 * 1000)) {
            continue;
        }

        // Fetch settings for this library to get templates
        const settings = await prisma.settings.findFirst({
            where: { library_id: loan.library_id }
        });

        let subject = `Overdue Book Reminder: ${loan.book.name}`;
        let html = `<p>Dear ${loan.user.name},</p>
                   <p>This is a reminder that the book <strong>${loan.book.name}</strong> was due on ${loan.due_at.toDateString()}.</p>
                   <p>Please return it to the library as soon as possible.</p>`;

        // Apply custom template if exists
        const templates = settings?.email_templates as any;

        const daysLate = Math.ceil((now.getTime() - loan.due_at.getTime()) / (1000 * 60 * 60 * 24));
        const replaceVariables = (text: string) => {
            return text
                .replace(/{user}/g, `${loan.user.name} ${loan.user.surname || ''}`.trim())
                .replace(/{book}/g, loan.book.name)
                .replace(/{author}/g, loan.book.author)
                .replace(/{publisher}/g, loan.book.publisher)
                .replace(/{date}/g, loan.due_at.toDateString())
                .replace(/{borrow_date}/g, loan.borrowed_at.toDateString())
                .replace(/{days_late}/g, daysLate.toString());
        };

        if (templates?.overdue) {
            if (templates.overdue.subject) {
                subject = replaceVariables(templates.overdue.subject);
            }
            if (templates.overdue.body) {
                html = replaceVariables(templates.overdue.body)
                    // Convert newlines to breaks for basic HTML support from text area
                    .replace(/\n/g, '<br/>');
            }
        }

        const success = await sendEmail(loan.library_id, {
            to: loan.user.email,
            subject: subject,
            html: html
        });

        if (success) {
            await prisma.bookLoan.update({
                where: { id: loan.id },
                data: { last_reminder_sent_at: new Date(), reminder_stage: { increment: 1 } }
            });
        }
    }
};
