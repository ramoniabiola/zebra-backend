import { Router } from "express";
import UserPost from "../models/UserPost.js";
import verifyUserToken from "../middlewares/verifyUserToken.js"


const router = Router();

// GET ALL USER APARTMENT-LISTING POSTED

router.get("/:userId", verifyUserToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query; // Default page = 1, limit = 10

        // Ensure the authenticated user is requesting their own listings
        if (req.user.id !== userId) {
            return res.status(403).json({ error: "Forbidden: You can only view your own listings." });
        }

        // Find the user's apartment listings with pagination
        const userPosts = await UserPost.findOne({ userId }).populate({
            path: "apartment_listings.ApartmentId",
            model: "Apartment",
            options: { skip: (page - 1) * limit, limit: parseInt(limit), sort: { createdAt: -1 } } // Pagination & sorting
        });

        // If no listings found
        if (!userPosts || userPosts.apartment_listings.length === 0) {
            return res.status(404).json({ message: "No apartment listings found for this user." });
        }

        // Extract apartment details
        const apartments = userPosts.apartment_listings.map(listing => listing.ApartmentId);

        // Get total count of listings for pagination info
        const totalListings = userPosts.apartment_listings.length;
        const totalPages = Math.ceil(totalListings / limit);

        // Return paginated listings
        res.status(200).json({
            currentPage: Number(page),
            totalPages,
            totalListings,
            listingsPerPage: limit,
            apartments
        });
    } catch (err) {
        console.error("Error fetching user's apartment listings:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



//SEARCH A SPECIFIC USER APARTMENT-LISTING WITHIN THEIR OWN POSTED APARTMENTS

router.get("/:userId/search", verifyUserToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { query } = req.query; // Get search query from request

        // Ensure the authenticated user is accessing their own listings
        if (req.user.id !== userId) {
            return res.status(403).json({ error: "Forbidden: You can only search within your own apartment listings." });
        }

        // Construct a case-insensitive search query
        const searchQuery = {
            userId,
            $or: [ 
                { "apartment_listings.ApartmentId.title": { $regex: new RegExp(query, "i") } },
                { "apartment_listings.ApartmentId.apartment_address": { $regex: new RegExp(query, "i") } }
            ]
        };

        // Search for apartments that match the query
        const userPosts = await UserPost.findOne(searchQuery).populate({
            path: "apartment_listings.ApartmentId",
            model: "Apartment"
        });

        // If no matching apartments are found
        if (!userPosts || userPosts.apartment_listings.length === 0) {
            return res.status(404).json({ error: "No matching apartments found within your posted listings." });
        }

        // Extract the matched apartments
        const matchedApartments = userPosts.apartment_listings.map(listing => listing.ApartmentId);

        // Return the matched apartments
        res.status(200).json(matchedApartments);
    } catch (err) {
        console.error("Error searching for apartment:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// GET TOTAL COUNT OF USER'S APARTMENT LISTINGS

router.get("/count", verifyUserToken, async (req, res) => {
    try {
        // Count the number of apartments the user has listed
        const count = await UserPost.countDocuments({ userId: req.user.id });
        
        res.status(200).json({ totalListings: count });
    } catch (err) {
        console.error("Error fetching total listings count:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// UPDATE AN APARTMENT LISTING POSTED BY THE USER

router.put("/update/:apartmentId", verifyUserToken, async (req, res) => {
    try {
        // Find the listing under the authenticated user's posts
        const userPost = await UserPost.findOne({ 
            userId: req.user.id, 
            "apartment_listings.ApartmentId": req.params.apartmentId 
        });

        if (!userPost) {
            return res.status(404).json({ error: "Apartment listing not found" });
        }

        // Update the apartment listing details
        const updatedApartment = await Apartment.findByIdAndUpdate(
            req.params.apartmentId, 
            { $set: req.body }, 
            { new: true }
        );

        res.status(200).json(updatedApartment);
    } catch (err) {
        console.error("Error updating apartment listing:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});





// SOFT DELETE(Deactivate) AN APARTMENT LISTING

router.put("/deactivate/:apartmentId", verifyUserToken, async (req, res) => {
    try {
        // Find the listing under the authenticated user's posts
        const userPost = await UserPost.findOne({ 
            userId: req.user.id, 
            "apartment_listings.ApartmentId": req.params.apartmentId 
        });

        if (!userPost) {
            return res.status(404).json({ error: "Apartment listing not found" });
        }

        // Mark the apartment as unavailable
        const updatedApartment = await Apartment.findByIdAndUpdate(
            req.params.apartmentId, 
            { isAvailable: false }, 
            { new: true }
        );

        res.status(200).json({ message: "Apartment listing has been deactivated.", updatedApartment });
    } catch (err) {
        console.error("Error deactivating apartment listing:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});





// REACTIVATE AN APARTMENT LISTING

router.put("/reactivate/:apartmentId", verifyUserToken, async (req, res) => {
    try {
        const userPost = await UserPost.findOne({ 
            userId: req.user.id, 
            "apartment_listings.ApartmentId": req.params.apartmentId 
        });

        if (!userPost) {
            return res.status(404).json({ error: "Apartment listing not found" });
        }

        // Mark the apartment as available again
        const updatedApartment = await Apartment.findByIdAndUpdate(
            req.params.apartmentId, 
            { isAvailable: true }, 
            { new: true }
        );

        res.status(200).json({ message: "Apartment listing has been reactivated.", updatedApartment });
    } catch (err) {
        console.error("Error reactivating apartment listing:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// GET ALL DEACTIVATED APARTMENT LISTINGS 

router.get("/deactivated", verifyUserToken, async (req, res) => {
    try {
        const userApartments = await Apartment.find({ 
            createdBy: req.user.id, 
            isAvailable: false 
        }).sort({ createdAt: -1 });

        res.status(200).json(userApartments);
    } catch (err) {
        console.error("Error fetching deactivated apartments:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




export default router;