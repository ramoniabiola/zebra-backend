import dotenv from 'dotenv';
dotenv.config(); // Load env first

import { Resend } from 'resend';


const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationCode = async (email, code) => {
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your Verification Code',
      html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    });
  } catch (error) {
    console.error('Failed to send code:', error);
    throw new Error('Email send failure');
  }
};
