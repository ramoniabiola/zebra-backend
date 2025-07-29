import express from "express";
import { Resend } from "resend";

const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const verificationCodes = {}; // Store in-memory (for now)



export const sendVerificationCode = async (email, code) => {
    try {
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev', 
            to: email,                    
            subject: 'Your Verification Code',
            html: `<p>Your code is <strong>${code}</strong></p>`,
        });

        console.log('Resend response:', data);
        return { success: true };
    } catch (err) {
        console.error('Resend error:', err);
        return { success: false, error: err.message };
    }
};


router.post("/send-verification-code", async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000);

    const result = await sendVerificationCode(email, code);

    if (!result.success) {
        return res.status(500).json({ error: result.error });
    }

    // Store code in memory or DB here
    res.status(200).json({ message: "Verification code sent to email" });
});



router.post("/verify-code", (req, res) => {
    const { email, code } = req.body;
    const record = verificationCodes[email];

    if (!record || record.expiresAt < Date.now()) {
        return res.status(400).json({ error: "Code expired or not found" });
    }

    if (parseInt(code) !== record.code) {
        return res.status(400).json({ error: "Invalid code" });
    }

    delete verificationCodes[email]; // Optional: clean up
    res.status(200).json({ message: "Email verified" });
});


export default router;