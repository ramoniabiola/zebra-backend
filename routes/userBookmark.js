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

        // Populate the apartment details for the newly added bookmark
        await userBookmark.populate({
            path: "apartment_listings.apartmentId",
        });

        // Find the newly added bookmark (first one due to unshift)
        const newBookmark = userBookmark.apartment_listings[0];

        res.status(200).json(newBookmark);
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
        });

        if (!userBookmark) {
            return res.status(200).json({
                totalBookmarks: 0,
                currentPage: parseInt(page),
                totalPages: 0,
                bookmarks: [],
            });
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
        const { 
            title, 
            location, 
            apartment_type,
            bedrooms,
            min_price,
            max_price,
            keyword, // General search term
            page = 1, 
            limit = 10 
        } = req.query;

        // Parse pagination values safely
        const pageNumber = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 10)); // Limit max page size
        const skip = (pageNumber - 1) * pageSize;

        // Find the user's bookmarked apartments - REMOVED SORT FROM POPULATE
        const userBookmark = await UserBookmark.findOne({ userId })
            .populate({
                path: "apartment_listings.apartmentId"
            })
            .lean();

        // If no bookmarks found
        if (!userBookmark || userBookmark.apartment_listings.length === 0) {
             return res.status(404).json({ 
                message: "No bookmarked apartments found.",
                totalResults: 0,
                currentPage: pageNumber,
                totalPages: 0,
                listings: []
            });
        }

        // Remove bookmarks pointing to deleted apartments
        let filteredListings = userBookmark.apartment_listings.filter(apartment => apartment.apartmentId);

        // SORT HERE AFTER POPULATION
        filteredListings.sort((a, b) => {
            const dateA = new Date(a.apartmentId.createdAt);
            const dateB = new Date(b.apartmentId.createdAt);
            return dateB - dateA; // Sort by newest first
        });

        // Apply search filters
        if (keyword && keyword.trim()) {
            const searchTerm = keyword.trim().toLowerCase();
            filteredListings = filteredListings.filter(apartment => {
                const apt = apartment.apartmentId;
                return (
                    apt.title?.toLowerCase().includes(searchTerm) ||
                    apt.description?.toLowerCase().includes(searchTerm) ||
                    apt.location?.toLowerCase().includes(searchTerm) ||
                    apt.apartment_type?.toLowerCase().includes(searchTerm)
                );
            });
        }

        // Apply specific filters
        if (title && title.trim()) {
            filteredListings = filteredListings.filter(apartment =>
                apartment.apartmentId.title?.toLowerCase().includes(title.toLowerCase())
            );
        }

        if (location && location.trim()) {
            filteredListings = filteredListings.filter(apartment =>
                apartment.apartmentId.location?.toLowerCase().includes(location.toLowerCase())
            );
        }

        if (apartment_type && apartment_type.trim()) {
            filteredListings = filteredListings.filter(apartment =>
                apartment.apartmentId.apartment_type?.toLowerCase().includes(apartment_type.toLowerCase())
            );
        }

        if (bedrooms) {
            const bedroomCount = parseInt(bedrooms);
            if (!isNaN(bedroomCount)) {
                filteredListings = filteredListings.filter(apartment =>
                    apartment.apartmentId.bedrooms === bedroomCount
                );
            }
        }

        // Price range filters
        if (min_price || max_price) {
            filteredListings = filteredListings.filter(apartment => {
                const price = apartment.apartmentId.price;
                if (!price) return false;
                
                let matchesPrice = true;
                if (min_price) {
                    const minPriceNum = parseInt(min_price);
                    if (!isNaN(minPriceNum)) {
                        matchesPrice = matchesPrice && price >= minPriceNum;
                    }
                }
                if (max_price) {
                    const maxPriceNum = parseInt(max_price);
                    if (!isNaN(maxPriceNum)) {
                        matchesPrice = matchesPrice && price <= maxPriceNum;
                    }
                }
                return matchesPrice;
            });
        }

        // If no results match the search
        if (filteredListings.length === 0) {
            return res.status(404).json({ 
                message: "No matching bookmarked apartments found.",
                totalResults: 0,
                currentPage: pageNumber,
                totalPages: 0,
                listings: []
            });
        }

        // Apply pagination
        const paginatedListings = filteredListings.slice(skip, skip + pageSize);

        // Return results
        res.status(200).json({
            success: true,
            totalResults: filteredListings.length,
            currentPage: pageNumber,
            totalPages: Math.ceil(filteredListings.length / pageSize),
            hasNextPage: pageNumber < Math.ceil(filteredListings.length / pageSize),
            hasPrevPage: pageNumber > 1,
            listings: paginatedListings,
        });

    } catch (err) {
        console.error("Error fetching bookmarked apartments:", err);
        res.status(500).json({ 
            message: "Internal server error"
        });
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