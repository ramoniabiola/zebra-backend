import express from "express";
import UserBookmark from "../models/UserBookmark.js";
import verifyTenantToken from "../middlewares/verifyTenantToken.js"

const router = express.Router();

// CREATE OR UPDATE USER BOOKMARK (Tenant)
router.post("/", verifyTenantToken, async (req, res) => {
    try {
        const { apartmentId } = req.body;
        const userId = req.user.id; // Get user ID from token

        // Ensure only tenants can bookmark apartments
        if (req.user.role !== "tenant") {
            return res.status(403).json({ error: "Only tenants can bookmark apartments." });
        }

        // Check if the user already has a bookmark list
        let userBookmark = await UserBookmark.findOne({ userId });

        if (!userBookmark) {
            // If no bookmark exists, create a new one
            userBookmark = new UserBookmark({
                userId,
                apartment_listings: [{ apartmentId: apartmentId }],
            });
        } else {
            // Prevent duplicate bookmarks
            const alreadyBookmarked = userBookmark.apartment_listings.some(
                (item) => item.apartmentId.toString() === apartmentId
            );

            if (alreadyBookmarked) {
                return res.status(400).json({ error: "You have already bookmarked this apartment." });
            }

            // Add the new apartment to the bookmarks list 
            userBookmark.apartment_listings.unshift({ apartmentId: apartmentId });
        }

        // Save the bookmark
        await userBookmark.save();
        res.status(200).json({ message: "Apartment bookmarked successfully", userBookmark });
    } catch (err) {
        console.error("Error bookmarking apartment:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// GET ALL USER BOOKMARKS (Tenant)
router.get("/", verifyTenantToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query; // Pagination

        if (req.user.role !== "tenant") {
            return res.status(403).json({ error: "Only tenants can access bookmarks." });
        }

        // Find user bookmarks
        const userBookmark = await UserBookmark.findOne({ userId })
            .populate({
                path: "apartment_listings.apartmentId", // Populate apartment details
                select: "-createdAt -updatedAt", // Exclude timestamps for cleaner data
            })
            .lean();

        if (!userBookmark || userBookmark.apartment_listings.length === 0) {
            return res.status(404).json({ error: "No bookmarked apartments found." });
        }
 
        // Paginate bookmarks
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedBookmarks = userBookmark.apartment_listings.slice(startIndex, endIndex);

        res.status(200).json({
            totalBookmarks: userBookmark.apartment_listings.length,
            currentPage: parseInt(page),
            totalPages: Math.ceil(userBookmark.apartment_listings.length / limit),
            bookmarks: paginatedBookmarks,
        });
    } catch (err) {
        console.error("Error fetching bookmarks:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// REMOVE A BOOKMARKED APARTMENT LISTING
router.delete("/:apartmentId", verifyTenantToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const apartmentId = req.params.apartmentId;

        // Find the user's bookmark entry
        const userBookmark = await UserBookmark.findOne({ userId });

        if (!userBookmark) {
            return res.status(404).json({ error: "No bookmarks found for this user." });
        }

        // Filter out the apartment being removed
        userBookmark.apartment_listings = userBookmark.apartment_listings.filter(
            (bookmark) => bookmark.apartmentId.toString() !== apartmentId
        );

        // Save the updated bookmark list
        await userBookmark.save();

        res.status(200).json({ message: "Bookmark removed successfully." });
    } catch (err) {
        console.error("Error removing bookmark:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// GET A SPECIFIC BOOKMARKED APARTMENT WITHIN USER BOOKMARKED APARTMENT LISTINGS

router.get("/search", verifyTenantToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, location, page = 1, limit = 10 } = req.query;

        // Ensure at least one search parameter is provided
        if (!title && !location) {
            return res.status(400).json({ error: "Please provide a title or location for search." });
        }

        // Parse pagination values safely
        const pageNumber = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 10;
        const skip = (pageNumber - 1) * pageSize;

        // Find the user's bookmarked apartments
        const userBookmark = await UserBookmark.findOne({ userId })
        .populate({
            path: "apartment_listings.apartmentId", 
            options: { sort: { createdAt: -1 } }, // Sort by newest
        })
        .lean();

        // If no bookmarks found
        if (!userBookmark || userBookmark.apartment_listings.length === 0) {
            return res.status(404).json({ error: "No bookmarked apartments found." });
        }

        // Remove bookmarks pointing to deleted apartments
        let filteredListings = userBookmark.apartment_listings.filter(apartment => apartment.apartmentId);

        // Apply search filters
        if (title) {
            filteredListings = filteredListings.filter(apartment =>
                apartment.apartmentId.title.toLowerCase().includes(title.toLowerCase())
            );
        }

        if (location) {
            filteredListings = filteredListings.filter(apartment =>
                apartment.apartmentId.location.toLowerCase().includes(location.toLowerCase())
            );
        }

        // If no results match the search
        if (filteredListings.length === 0) {
            return res.status(404).json({ error: "No matching bookmarked apartments found." });
        }

        // Apply pagination
        const paginatedListings = filteredListings.slice(skip, skip + pageSize);

        // Return results
        res.status(200).json({
            totalResults: filteredListings.length,
            currentPage: pageNumber,
            totalPages: Math.ceil(filteredListings.length / pageSize),
            listings: paginatedListings,
        });

    } catch (err) {
        console.error("Error fetching bookmarked apartments:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});





// CLEAR ALL USER BOOKMARKS

router.delete("/clear", verifyTenantToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find and update the user's bookmark list (set apartment_listings to an empty array)
        const updatedBookmark = await UserBookmark.findOneAndUpdate(
            { userId },
            { $set: { apartment_listings: [] } },
            { new: true }
        );

        if (!updatedBookmark) {
            return res.status(404).json({ error: "No bookmarks found for this user." });
        }

        res.status(200).json({ message: "All bookmarks have been cleared." });
    } catch (err) {
        console.error("Error clearing bookmarks:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});





export default router;