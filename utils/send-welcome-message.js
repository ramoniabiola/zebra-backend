import dotenv from 'dotenv';
dotenv.config(); // Load env first

import { Resend } from 'resend';


const resend = new Resend(process.env.RESEND_API_KEY);

export const sendWelcomeMail = async (userEmail) => {
    try {
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: userEmail,
            subject: 'Welcome to Zebra',
            html: '<p>Hello there! Your signup was successful 🎉</p>',
        });
    } catch (error) {
        console.error("Email failed:", error);
        throw new Error('Email send failure');
    }
};