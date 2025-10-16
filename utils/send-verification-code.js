import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // your Gmail address
    pass: process.env.GMAIL_PASS, // App Password (not your login password)
  },
});

export const sendVerificationCode = async (email, code) => {
  const info = await transporter.sendMail({
    from: `"Zebra App" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your Verification Code",
    html: `<p>Your verification code is <strong>${code}</strong></p>`,
  });

  console.log("Email sent:", info.response);
};
