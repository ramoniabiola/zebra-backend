import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export const sendVerificationCode = async (email, code) => {
  try {
    const info = await transporter.sendMail({
      from: `"Zebra App" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your Verification Code",
      html: `<p>Your verification code is <strong>${code}</strong></p>`,
    });
    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

