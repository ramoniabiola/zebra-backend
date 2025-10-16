import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER, // your Gmail address
        pass: process.env.GMAIL_PASS, // App Password (not your login password)
    },
});



export const sendWelcomeMail = async (email) => {
    const info = await transporter.sendMail({
        from: `"Zebra App" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Welcome to Zebra",
        html: "<p>Hello there! Your signup was successful 🎉</p>",
    });

    console.log("Email sent:", info.response);
};