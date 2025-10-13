import { Router } from "express";
import User from "../models/User.js";
import VerificationCode from '../models/VerificationCode.js';
import { generateCode } from '../utils/generate-code.js';
import { sendVerificationCode } from '../utils/send-verification-code.js';
import { sendWelcomeMail } from "../utils/send-welcome-message.js";
import jwt from "jsonwebtoken";
import { createAndEmitNotification } from "../services/notificationService.js";

const router = Router();


// USER REGISTRATION OPERATION
router.post('/send-verification-code', async (req, res) => {
    const { email } = req.body;

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 min

    try {
        // Save or update code in DB
        await VerificationCode.findOneAndUpdate(
            { email },
            { code, expiresAt },
            { upsert: true }
        );

        await sendVerificationCode(email, code);
        res.status(200).json({ message: 'Verification code sent to email.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Could not send verification code.' });
    }
});



router.post('/code-verification', async (req, res) => {
    const { email, code } = req.body;

    try {
        const record = await VerificationCode.findOne({ email });

        if (!record || record.code !== code) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        if (record.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Verification code expired.' });
        }

        res.status(200).json({ message: 'Email verified successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Code verification failed.' });
    }
});



router.post('/register', async (req, res) => {
    const { email, password, ...userData } = req.body;

    try {

        // Create user
        const user = await User.signup(password, { email, ...userData });

        // Clean up verification record
        await VerificationCode.deleteOne({ email });

        // Sanitize response
        const { password: hashed, ...safeUser } = user._doc;


        // Notify User(tenant / landlord or agent)
        await createAndEmitNotification({
            userId: user._id,
            role: user.role, 
            message: `🎉 Welcome ${user.username}!, Your account has been successfully created.`
        });

        // Send welcome email
        await sendWelcomeMail(email);

        res.status(201).json({ ...safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'User registration failed.' });
    }
});





// LOGIN
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {  
        
        const user = await User.login(email, password);

        // Ensure user exists and has a _doc property
        if (!user || !user._doc) {
            return res.status(500).json({ error: "Login failed, please try again." });
        }

        // Generate JWT with User ID, Role, and Email
        const accessToken = jwt.sign(
            { id: user._id, role: user.role, email: user.email }, 
            process.env.JWT_SECRET_KEY,
            { expiresIn: "14d" }
        );

        // Destructure user object and omit 'password' field
        const { password: hashedPassword, ...userDataWithoutPassword } = user._doc;

        // Send token in HTTP-only cookie for better security
        res.cookie("accessToken", accessToken, {
            httpOnly: true,   // Prevents XSS attacks
            secure: process.env.NODE_ENV === "production", // Use HTTPS in production
            sameSite: "None", // ✅ Must be 'None' for cross-domain requests
            maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        }); 

        // Send user data in response (excluding password)
        res.status(200).json(userDataWithoutPassword);
    } catch (error) {
        if (error.message.includes("Incorrect email...") || error.message.includes("Incorrect password...")) {
            return res.status(401).json({ error: error.message }); // Unauthorized
        }
        res.status(500).json({ error: "Internal server error" });
    }         
}); 



// LOGOUT
router.post("/logout", (req, res) => {
    res.cookie("accessToken", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", 
        sameSite: "Strict",
        expires: new Date(0) // Expire the cookie immediately
    });

    res.status(200).json({ message: "Logged out successfully..." });
});


export default router;
