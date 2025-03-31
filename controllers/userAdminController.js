import { Router } from "express";
import UserAdmin from "../models/UserAdmin.js";
import User from "../models/User.js";
import ReportLog from "../models/ReportLog.js"; 
import Apartment from "../models/Apartment.js";
import verifyAdminToken from "../middlewares/verifyAdminToken.js";
import verifySuperAdminToken from "../middlewares/verifySuperAdminToken.js";
import logAdminAction from "../middlewares/logAdminAction.js";
import bcrypt from "bcryptjs";
import moment from "moment";

const router = Router();

// UPDATE AN ADMIN ACCOUNT
router.put("/update", verifyAdminToken, async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const adminId = req.user.id; // Extract admin ID from token

        // Find admin user by ID
        const admin = await UserAdmin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ error: "Admin not found." });
        }

        // Check if email is already in use (excluding current admin)
        if (email && email !== admin.email) {
            const existingEmail = await UserAdmin.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ error: "Email already in use." });
            }
        }

        // If updating password, hash it first
        let hashedPassword = admin.password;
        if (password) {
            if (!bcrypt.compareSync(password, admin.password)) {  // Ensure it's a new password
                const salt = await bcrypt.genSalt(10);
                hashedPassword = await bcrypt.hash(password, salt);
            } else {
                return res.status(400).json({ error: "New password must be different from the old password." });
            }
        }

        // Update fields
        admin.name = name || admin.name;
        admin.email = email || admin.email;
        admin.password = hashedPassword;

        // Save updated admin data
        const updatedAdmin = await admin.save();

        // Remove password before sending response
        const { password: _, ...adminData } = updatedAdmin._doc;

        res.status(200).json({ message: "Admin account updated successfully.", admin: adminData });
    } catch (error) {
        console.error("Error updating admin account:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});




// GET ALL ADMIN (superadmin only)

router.get("/users", verifySuperAdminToken, async (req, res) => {
    try {
        const admins = await UserAdmin.find({}, "-password"); // Exclude passwords
        res.status(200).json(admins);
    } catch (err) {
        console.error("Error fetching admins:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// GET A SPECIFIC ADMIN PROFILE
router.get("/users/:id", verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.id !== id && req.user.role !== "superadmin") {
            return res.status(403).json({ error: "Unauthorized access" });
        }

        const admin = await UserAdmin.findById(id).select("-password");

        if (!admin) {
            return res.status(404).json({ error: "Admin not found" });
        }

        res.status(200).json(admin);
    } catch (err) {
        console.error("Error fetching admin:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// DELETE AN ADMIN (superadmin only)
router.delete("/users/:id", verifySuperAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;  // Authenticated superadmin performing the action

    
        const deletedAdmin = await UserAdmin.findByIdAndDelete(id);
        if (!deletedAdmin) {
            return res.status(404).json({ error: "Admin not found" });
        }

        // Log the action 
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        await logAdminAction(adminId, `[${timestamp}]: Deleted ${deletedAdmin.role}-${deletedAdmin.name}'s Account`, id);

        res.status(200).json({ message: "Admin deleted successfully" });
    } catch (err) {
        console.error("Error deleting admin:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// UPDATE AN ADMIN ROLE(superadmin only)

router.patch("/users/:id/role", verifySuperAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const adminId = req.user.id;  // Authenticated superadmin performing the action


        if (!["superadmin", "moderator"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const updatedAdmin = await UserAdmin.findByIdAndUpdate(id, { role }, { new: true }).select("-password");

        if (!updatedAdmin) {
            return res.status(404).json({ error: "Admin not found" });
        }

        // Log the action
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        await logAdminAction(adminId, `[${timestamp}]: Changed ${updatedAdmin.role}-${updatedAdmin.name}'s Role`, id);

        res.status(200).json(updatedAdmin);
    } catch (err) {
        console.error("Error updating admin role:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// ADMIN DASHBOARD STATS

router.get("/stats", verifyAdminToken, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalListings = await Apartment.countDocuments({ isAvailable: true });
        const recentListings = await Apartment.find().sort({ createdAt: -1 }).limit(5).select("title location price");

        res.status(200).json({
            totalUsers,
            totalListings,
            recentListings,
        });
    } catch (err) {
        console.error("Error fetching admin stats:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


// MANAGE REPORTED APARTMENT LISTING

router.get("/reports", verifyAdminToken, async (req, res) => {
    try {
        const reports = await ReportLog.find()
            .populate("apartmentId", "title location") // Get apartment details
            .populate("reportedBy", "name email") // Get user details
            .sort({ createdAt: -1 });

        if (!reports.length) {
            return res.status(404).json({ error: "No reports found." });
        }

        res.status(200).json(reports);
    } catch (err) {
        console.error("Error fetching reports:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// RESOLVE A REPORT OF AN APARTMENT LISTING

router.patch("/resolve-report/:reportId", verifyAdminToken, async (req, res) => {
    try {
        const { reportId } = req.params;

        // Find the report
        const report = await ReportLog.findById(reportId);
        if (!report) {
            return res.status(404).json({ error: "Report not found." });
        }

        // Update report status to "resolved"
        report.status = "resolved";
        report.resolvedAt = new Date(); // Record resolution time
        await report.save();

        // Update apartment report count (decrement by 1)
        await Apartment.findByIdAndUpdate(report.apartmentId, { $inc: { reportCount: -1 } });

        res.status(200).json({ message: "Report resolved successfully.", report });
    } catch (err) {
        console.error("Error resolving report:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// SUSPEND A USER (landlord, agent or tenant)

router.patch("/users/:id/suspend", verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { isSuspended } = req.body;
        const adminId = req.user.id; // Authenticated admin performing the action

        const updatedUser = await User.findByIdAndUpdate(id, { isSuspended }, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // Log the action
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        await logAdminAction(adminId, `[${timestamp}]: Suspended ${updatedUser.role}-${updatedUser.username}'s Account`, id, req.ip);

        res.status(200).json({ message: `User ${isSuspended ? "suspended" : "unsuspended"} successfully.` });
    } catch (err) {
        console.error("Error suspending user:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// TRACK ADMIN ACTIVITIES(Retrieving Admin Logs)

router.get("/logs", verifySuperAdminToken, async (req, res) => {
    try {
        const logs = await AdminLog.find().sort({ createdAt: -1 });

        if (!logs.length) {
            return res.status(404).json({ error: "No logs found" });
        }

        res.status(200).json(logs);
    } catch (err) {
        console.error("Error fetching logs:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});





export default router;


