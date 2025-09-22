import { Router } from "express";
import Notification from "../models/Notification.js";
import verifyGeneralUserToken from "../middlewares/verifyGeneralUserToken.js";

const router = Router();

// Get my notifications (paginated)
router.get("/", verifyGeneralUserToken, async (req, res) => {
    try {
        const { role, page = 1, limit = 10, unreadOnly } = req.query;

        const filter = { user: req.user.id };
        if (role) filter.role = role;
        if (unreadOnly === "true") filter.isRead = false;

        const docs = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

      const total = await Notification.countDocuments(filter);

        res.json({
            notifications: docs,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



// Mark one as read
router.patch("/:id/read", verifyGeneralUserToken, async (req, res) => {
    try {
        const updated = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { $set: { isRead: true } },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: "Notification not found" });
        res.json(updated);
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Mark all as read
router.patch("/read-all", verifyGeneralUserToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true });
    } catch (error) {
        console.error("Error marking all as read:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Delete one
router.delete("/:id", verifyGeneralUserToken, async (req, res) => {
    try {
        const deleted = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!deleted) return res.status(404).json({ error: "Notification not found" });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting notification:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
