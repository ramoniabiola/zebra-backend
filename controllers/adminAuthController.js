import { Router } from "express";
import UserAdmin from "../models/UserAdmin.js";
import jwt from "jsonwebtoken"
import verifySuperAdminToken from "../middlewares/verifySuperAdminToken.js";

const router = Router();


// USER-ADMIN REGISTRATION(Only superadmin can create a new admin)
router.post("/admin/register", verifySuperAdminToken, async (req, res) => {
    const { name, email, password, role } = req.body;

    try {

        // Validate role to prevent unauthorized users from setting their own role as superadmin
        if (!["superadmin", "moderator"].includes(role)) {
          return res.status(400).json({ error: "Invalid role. Allowed roles: superadmin, moderator." }); 
        }

        //Call the signup method from the UserAdmin model
        const newAdmin = await UserAdmin.signup(password, { name, email, role });

        // Respond with success message
        res.status(201).json({ admin: newAdmin });

    }catch(error) {
        // If an error occurs during signup, send an error response
        res.status(400).json({error: error.message});
    }
});



// LOGIN
router.post("/admin/login", async (req, res) => {
    const { email, password } = req.body;

    try {  
        
        const userAdmin = await UserAdmin.login(email, password);

        // Ensure userAdmin exists and has a _doc property
        if (!userAdmin || !userAdmin._doc) {
            return res.status(500).json({ error: "Login failed, please try again." });
        }

        // // Generate JWT with useradmin ID and role. 
        const accessToken = jwt.sign(
            { id: userAdmin._id, role: userAdmin.role }, 
            process.env.JWT_SECRET_KEY,
            { expiresIn: "14d" } // Token expires in 14days
        );


        // Destructure userAdmin object and omit 'password' field
        const { password, ...userAdminDataWithoutPassword } = userAdmin._doc;

        // Send token in HTTP-only cookie for better security
        res.cookie("accessToken", accessToken, {
            httpOnly: true,   // Prevents XSS attacks
            secure: process.env.NODE_ENV === "production", // Use HTTPS in production
            sameSite: "Strict",  // Prevents CSRF attacks
            maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        }); 

        // Send user data in response (excluding password)
        res.status(200).json(userAdminDataWithoutPassword);
    } catch (error) {
        if (error.message.includes("Incorrect username...") || error.message.includes("Incorrect password...")) {
            return res.status(401).json({ error: error.message }); // Unauthorized
        }
        res.status(500).json({ error: "Internal server error" });
    }         
}); 



// LOGOUT
router.post("/admin/logout", (req, res) => {
    res.cookie("accessToken", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", 
        sameSite: "Strict",
        expires: new Date(0) // Expire the cookie immediately
    });

    res.status(200).json({ message: "Logged out successfully..." });
});


export default router;