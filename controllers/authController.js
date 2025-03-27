import { Router } from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = Router();


// USER REGISTRATION
router.post("/register", async (req, res) => {
    const { password, ...userData } = req.body;

    try {
        // Call the static signup method of the User model
        const user = await User.signup(password, userData);

        // Ensure user exists and has a _doc property
        if (!user || !user._doc) {
            return res.status(500).json({ error: "User registration failed" });
        }

        // Destructure user object and omit 'password' field
        const { password: hashedPassword, ...userDataWithoutPassword } = user._doc;
    
        // If signup is successful, send a success response
        res.status(200).json({ ...userDataWithoutPassword });
    
    } catch(error) {
        // If an error occurs during signup, send an error response
        res.status(400).json({error: error.message});
    }
});




// LOGIN
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {  
        
        const user = await User.login(username, password);

        // Ensure user exists and has a _doc property
        if (!user || !user._doc) {
            return res.status(500).json({ error: "Login failed, please try again." });
        }

        // Generate JWT with User ID and Role
        const accessToken = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET_KEY,
            { expiresIn: "14d" } // Token expires in 14days
        );


        // Destructure user object and omit 'password' field
        const { password: hashedPassword, ...userDataWithoutPassword } = user._doc;

        // Send token in HTTP-only cookie for better security
        res.cookie("accessToken", accessToken, {
            httpOnly: true,   // Prevents XSS attacks
            secure: process.env.NODE_ENV === "production", // Use HTTPS in production
            sameSite: "Strict",  // Prevents CSRF attacks
            maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        }); 

        // Send user data in response (excluding password)
        res.status(200).json(userDataWithoutPassword);
    } catch (error) {
        if (error.message.includes("Incorrect username...") || error.message.includes("Incorrect password...")) {
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
