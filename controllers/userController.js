import { Router } from "express";
import User from "../models/User.js";
import verifyAdminToken from "../middlewares/verifyAdminToken.js"
import verifyGeneralUserToken from "../middlewares/verifyGeneralUserToken.js"
import moment from "moment";
import bcrypt from "bcryptjs";

const router = Router();


// UPDATE USER
router.put("/:id", verifyGeneralUserToken, async (req, res) => {
    try {
        // the logged-in user can only update their own info
        if (req.user.id !== req.params.id) {
            return res.status(403).json({ error: "Forbidden: You can only update your own profile." });
        } 

        // Prevention of sensitive updates (e.g., role change)
        delete req.body.role;

        // Encrypt password if it's being updated
        if (req.body.password) {
            req.body.password = await bcrypt.hash(req.body.password, 10); // Salt rounds = 10
        }
  
        // Find and update the user by ID
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            { $set: req.body }, 
            { new: true, select: "-password" } // Exclude password in response
        );

        // If user not found, return 404 Not Found
        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // Return updated user
        res.status(200).json(updatedUser);
    } catch (err) {

        // Handle unexpected errors
        console.error("Error updating user:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// DELETE USER (Landlord, Tenant, Agent)
router.delete("/:id", verifyGeneralUserToken, async (req, res) => {
    try {
        // Ensure the logged-in user is deleting their own account
        if (req.user.id !== req.params.id) {
            return res.status(403).json({ error: "Forbidden: You can only delete your own account." });
        }

        // Soft delete (recommended) - Mark user as deleted instead of removing
        const deletedUser = await User.findByIdAndUpdate(
            req.params.id, 
            { isDeleted: true }, 
            { new: true }
        );

        // If user not found, return 404 Not Found
        if (!deletedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // Return success message
        res.status(200).json({ message: "Your account has been successfully deactivated." });
    } catch (err) {
        // Handle unexpected errors
        console.error("Error deleting user:", err);
        res.status(500).json({ error: "Internal server error" });
    }
})




// DELETE USER (Admin Authorization Only)
router.delete("/admin/delete/:id", verifyAdminToken, async (req, res) => {
    try {
        // Find user by ID
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Perform a soft delete by setting `isDeleted` to `true`
        await User.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });

    
        // Log Admin User Deletion with Timestamp
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        console.log(`[${timestamp}]: Admin-(${req.user.id}) deleted User-${req.params.id}`);

        res.status(200).json({ message: "User has been successfully deactivated..." });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// GET USER (Landlord, Tenant, Agent)
router.get("/find/:id", verifyGeneralUserToken, async (req, res) => {
    try {
        // Ensure users can only access their own data
        if (req.user.id !== req.params.id) {
            return res.status(403).json({ error: "Forbidden: You can only access your own account details." });
        }

        // Find user by ID and ensure they are not deleted
        const user = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Exclude password field from response
        const { password, ...otherDetails } = user._doc;

        res.status(200).json({ ...otherDetails });
    } catch (err) {
        console.error("Error finding user:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// GET USER (Admin Access)
router.get("/admin/find/:id", verifyAdminToken, async (req, res) => {
    try {
        // Find user by ID (admin can fetch all users, even soft-deleted ones)
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Exclude password field from response
        const { password, ...otherdetails } = user._doc;

        res.status(200).json({ ...otherdetails });
    } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// GET ALL USERS (Admin Access)
router.get("/admin/users", verifyAdminToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, role } = req.query; // Defaults: page 1, 10 users per page
        const query = {};

        // Optional: Filter users by role (landlord, agent, tenant)
        if (role) {
            query.role = role;
        }

        // Exclude deactivated users if needed
        query.isDeleted = { $ne: true };

        // Pagination logic
        const skip = (page - 1) * limit;
        const totalUsers = await User.countDocuments(query);
        
        // Fetch users based on filters
        const users = await User.find(query)
            .sort({ createdAt: -1 }) // Latest users first
            .skip(skip)
            .limit(parseInt(limit));

        // Exclude passwords before sending response
        const sanitizedUsers = users.map(({ _doc }) => {
            const { password, ...otherDetails } = _doc;
            return otherDetails;
        });

        res.status(200).json({
            totalUsers,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalUsers / limit),
            users: sanitizedUsers
        });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// GET USER STATS (Monthly Registrations for the Past Year)
router.get("/stats", verifyAdminToken, async (req, res) => {
    try {
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);

        const data = await User.aggregate([
            { $match: { createdAt: { $gte: lastYear } } }, // Filter users from the last year
            { $project: { month: { $month: "$createdAt" } } }, // Extract month
            { 
                $group: { 
                    _id: "$month", 
                    total: { $sum: 1 } // Count users per month
                } 
            },
            { $sort: { _id: 1 } } // Sort by month (1 = Jan, 12 = Dec)
        ]);

        res.status(200).json(data);
    } catch (err) {
        console.error("Error fetching user stats:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// GET MONTHLY USER STATS BY ROLE
router.get("/stats-by-role", verifyAdminToken, async (req, res) => {
    try {
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);

        const data = await User.aggregate([
            { $match: { createdAt: { $gte: lastYear } } }, // Filter users from the last year
            { 
                $project: { 
                    month: { $month: "$createdAt" }, // Extract month (1-12)
                    role: 1 // Keep user role
                } 
            },
            { 
                $group: { 
                    _id: { month: "$month", role: "$role" }, 
                    total: { $sum: 1 } // Count users per role per month
                } 
            },
            { $sort: { "_id.month": 1 } } // Sort by month
        ]);

        res.status(200).json(data);
    } catch (err) {
        console.error("Error fetching user stats by role:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});





export default router;