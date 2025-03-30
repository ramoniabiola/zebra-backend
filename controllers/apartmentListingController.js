import { Router } from "express";
import Apartment from "../models/Apartment.js";
import verifyUserToken from "../middlewares/verifyUserToken.js";
import verifyAdminToken from "../middlewares/verifyAdminToken.js";
import moment from "moment"; 
import ViewLog from "../models/ViewLog.js"; 
import { getClientIp } from "request-ip"; // To get user IP address


const router = Router();


// CREATE AN APARTMENT LISTING (Only for Landlords & Agents)
router.post("/create", verifyUserToken, async (req, res) => {
    try {
        const { images } = req.body;

        // Ensure images do not exceed 10
        if (images && images.length > 10) {
            return res.status(400).json({ error: "You can upload a maximum of 10 images." });
        }

        // Create new apartment listing
        const newListing = new Apartment({
            ...req.body,
            createdBy: req.user.id // Attach user ID from token
        });

        // Save the new apartment to the database
        const savedListing = await newListing.save();

        // Return the saved apartment
        res.status(201).json(savedListing);
    } catch (err) {
        res.status(500).json({ error: "Failed to create apartment listing", message: err.message });
    }
});



// UPDATE AN APARTMENT LISTED (Only for Landlords/Agents)
router.put("/update/:id", verifyUserToken, async (req, res) => {
    try {
        // Find the listing to check ownership
        const listing = await Apartment.findById(req.params.id);

        // If listing not found
        if (!listing) {
            return res.status(404).json({ error: "Apartment not found" });
        }

        // Ensure only the creator (landlord/agent) can update it
        if (listing.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ error: "Forbidden: You can only update your own listings." });
        }

        // Proceed with the update
        const updatedListing = await Apartment.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true } // Return updated document
        );

        res.status(200).json(updatedListing);
    } catch (err) {
        console.error("Error updating listing:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// User-only Delete Route (Landlord/Agent)
router.delete("/delete/:id", verifyUserToken, async (req, res) => {
    try {
        const listing = await Apartment.findById(req.params.id);

        if (!listing) {
            return res.status(404).json({ error: "Apartment not found." });
        }

        // Ensure listing has a createdBy field before checking ownership
        if (!listing.createdBy || listing.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ error: "Forbidden: You can only delete your own listings." });
        }

        await Apartment.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Apartment listing has been deleted successfully." });
    } catch (err) {
        console.error("Error deleting apartment:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// Admin-only Delete Route
router.delete("/admin/delete/:id", verifyAdminToken, async (req, res) => {
    try {
        const listing = await Apartment.findById(req.params.id);

        if (!listing) {
            return res.status(404).json({ error: "Apartment not found." });
        }

        await Apartment.findByIdAndDelete(req.params.id);

        // Log Admin Apartment listing Deletion with Timestamp
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        console.log(`[${timestamp}]: Admin-(${req.user.id}) deleted listing ${req.params.id}`);

        res.status(200).json({ message: "Apartment listing has been deleted by an admin." });
    } catch (err) {
        console.error("Error deleting apartment:", err);
        res.status(500).json({ error: "Internal server error" });
    } 
});



// GET A PARTICULAR APARTMENT
router.get("/find/:id", async (req, res) => {
    try {
        // Find apartment listing by ID
        const listing = await Apartment.findById(req.params.id);

        // If apartment not found, return 404 Not Found
        if (!listing) {
            return res.status(404).json({ error: "Apartment listing not found" });
        }

        // Return apartment listing
        res.status(200).json(listing);
    } catch (err) {
        // Handle unexpected errors
        console.error('Error fetching apartment listing:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// GET ALL APARTMENT LISTINGS(paginated approach  to apartment listings)
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 10; // Default limit to 10 listings per request
        const skip = (page - 1) * limit;

        // Fetch listings with pagination
        const listings = await Apartment.find()
        .sort({ createdAt: -1 }) // Latest listings first
        .skip(skip)
        .limit(limit);

        // Get total count of listings
        const total = await Apartment.countDocuments();

        res.status(200).json({
            listings,
            total,
            hasMore: skip + listings.length < total // Check if more pages exist
        });
    } catch (err) {
        console.error("Error fetching Apartment listings:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// GET APARTMENT LISTINGS(search query) BASED ON (LOCATION & APARTMENT TYPE)
router.get("/search", async (req, res) => {
    try {
        const { location, apartment_type, page = 1, limit = 10 } = req.query;

        // Construct query object based on provided filters
        let query = {};

        // Filter by location (case-insensitive)
        if (location) {
            query.location = { $regex: new RegExp(location, "i") };
        }

        // Filter by apartment type
        if (apartment_type) {
            query.apartment_type = apartment_type;
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Fetch listings based on query
        const listings = await Apartment.find(query)
        .sort({ createdAt: -1 }) // Show latest apartments first
        .skip(skip)
        .limit(parseInt(limit));

        // Return results
        res.status(200).json(listings);
    } catch (err) {
        console.error("Error fetching apartment listings:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
 



// RECORD THE NUMBER OF USERS(potential tenants) THAT VIEWED AN APARTMENT LISTING

router.put("/view/:apartmentId", async (req, res) => {
    try {
        const { apartmentId } = req.params;
        const userId = req.user?.id || null; // Get user ID if logged in, else null
        const userIp = getClientIp(req) || req.headers["x-forwarded-for"] || req.socket.remoteAddress; // Get user's IP address

        // Check if this user or IP has already viewed this listing in the last 24 hours
        const existingView = await ViewLog.findOne({
            apartmentId,
            $or: [{ userId }, { userIp }],
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        });

        if (existingView) {
            return res.status(200).json({ message: "View already recorded within the last 24 hours." });
        }

        // Increment view count in Apartment model
        const updatedApartment = await Apartment.findByIdAndUpdate(
            apartmentId, 
            { $inc: { views: 1 } }, 
            { new: true }
        );

        // Log the view in the ViewLog model
        await ViewLog.create({
            apartmentId,
            userId,
            userIp
        });

        res.status(200).json({ message: "Apartment view count updated.", updatedApartment });
    } catch (err) {
        console.error("Error updating apartment views:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




export default router;