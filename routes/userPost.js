import { Router } from "express";
import UserPost from "../models/UserPost.js";
import Apartment from "../models/Apartment.js"
import verifyUserToken from "../middlewares/verifyUserToken.js"


const router = Router();

// GET ALL ACTIVE APARTMENT LISTINGS POSTED BY A USER
router.get("/:userId", verifyUserToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
    
        // Authorization check
        if (req.user.id !== userId) {
            return res.status(403).json({ error: "Forbidden: You can only view your own listings." });
        }
    
        // Get user's post tracker and populate ApartmentId 
        const userPosts = await UserPost.findOne({ userId }).populate("apartment_listings.ApartmentId");
    
        if (!userPosts || userPosts.apartment_listings.length === 0) {
            return res.status(404).json({ message: "No apartment listings found for this user." });
        }
    
        //  Filter: only active listings (isAvailable === true)
        const activeListings = userPosts.apartment_listings.filter(
            (listing) => listing.ApartmentId && listing.ApartmentId.isAvailable
        );
    
        //  Sort manually by postedAt (descending)
        activeListings.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
    
        //  Pagination
        const totalListings = activeListings.length;
        const totalPages = Math.ceil(totalListings / limit);
        const paginatedListings = activeListings.slice((page - 1) * limit, page * limit);
    
        // Extract populated Apartment documents
        const apartments = paginatedListings.map((listing) => listing.ApartmentId);

        // Send response
        res.status(200).json({
            message: "Active apartment listings fetched successfully.",
            currentPage: Number(page),
            totalPages,
            totalListings,
            listingsPerPage: Number(limit),
            apartments,
        });
    } catch (err) {
        console.error("Error fetching active listings:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
    }
});


// SEARCH USER'S ACTIVE APARTMENTS (isAvailable: true only)
router.get("/search/active", verifyUserToken, async (req, res) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;
        const userId = req.user.id;

        if (!query) {
            return res.status(400).json({ error: "Search query is required." });
        }

        // Fetch the user's listings and populate apartments
        const userPosts = await UserPost.findOne({ userId }).populate("apartment_listings.ApartmentId");

        if (!userPosts || userPosts.apartment_listings.length === 0) {
            return res.status(404).json({ error: "You have no posted apartments." });
        }

        // Filter by query + isAvailable === true
        const activeListings = userPosts.apartment_listings.filter((listing) => {
            const apt = listing.ApartmentId;
            if (!apt || !apt.isAvailable) return false;

            return (
                apt.title?.toLowerCase().includes(query.toLowerCase()) ||
                apt.apartment_address?.toLowerCase().includes(query.toLowerCase())
            );
        });

        const totalResults = activeListings.length;
        const listingsPerPage = parseInt(limit);
        const currentPage = parseInt(page);
        const totalPages = Math.ceil(totalResults / listingsPerPage);

        const paginatedResults = activeListings
            .slice((currentPage - 1) * listingsPerPage, currentPage * listingsPerPage)
            .map((listing) => listing.ApartmentId);

        if (paginatedResults.length === 0) {
            return res.status(404).json({ error: "No matching active apartments found on this page." });
        }

        res.status(200).json({
            message: "Matching active apartments retrieved successfully.",
            currentPage,
            totalPages,
            totalResults,
            listingsPerPage,
            results: paginatedResults,
        });
    } catch (err) {
        console.error("Error searching active listings:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
    }
});


// GET USER DASHBOARD LISTING METRICS
router.get("/count/dashboard", verifyUserToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Run all 3 counts in parallel for speed
    const [userPostDoc, activeCount, deactivatedCount] = await Promise.all([
      UserPost.findOne({ userId }), // To get total listings posted (based on history)
      Apartment.countDocuments({ userId, isAvailable: true }),
      Apartment.countDocuments({ userId, isAvailable: false }),
    ]);

    const totalPosted = userPostDoc?.apartment_listings?.length || 0;

    res.status(200).json({
      totalPosted,
      activeListings: activeCount,
      deactivatedListings: deactivatedCount,
    });
  } catch (err) {
    console.error("Error fetching dashboard counts:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});




// UPDATE AN APARTMENT LISTING POSTED BY THE USER
router.put("/update/:apartmentId", verifyUserToken, async (req, res) => {
    try {
        const { apartmentId } = req.params;
        const userId = req.user.id;

        // Ensure the apartment exists and belongs to the user
        const apartment = await Apartment.findOne({ _id: apartmentId, userId });

        if (!apartment) {
            return res.status(404).json({ error: "Apartment listing not found or unauthorized" });
        }

        // Update the apartment directly
        const updatedApartment = await Apartment.findByIdAndUpdate(
            apartmentId,
            { $set: req.body },
            { new: true }
        );

        res.status(200).json({
            message: "Apartment listing updated successfully",
            apartment: updatedApartment,
        });
    } catch (err) {
        console.error("Error updating apartment listing:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
    }
});


// SOFT DELETE (DEACTIVATE) AN APARTMENT LISTING
router.put("/deactivate/:apartmentId", verifyUserToken, async (req, res) => {
    try {
        const { apartmentId } = req.params;
        
        // Check if apartment exists and is owned by the user
        const apartment = await Apartment.findOne({ _id: apartmentId, userId: req.user.id });
        
        if (!apartment) {
            return res.status(404).json({ error: "Apartment listing not found or unauthorized." });
        }
      
        // If already deactivated
        if (!apartment.isAvailable) {
            return res.status(400).json({ error: "Apartment listing is already deactivated." });
        }
      
        // Deactivate the apartment
        apartment.isAvailable = false;
        const updatedApartment = await apartment.save();
      
        res.status(200).json({
            message: "Apartment listing has been successfully deactivated.",
            updatedApartment,
        });
    }  catch (err) {
      console.error("Error deactivating apartment listing:", err);
      res.status(500).json({ error: "Internal server error" });
    }
});



// REACTIVATE AN APARTMENT LISTING
router.put("/reactivate/:apartmentId", verifyUserToken, async (req, res) => {
    try {
        const { apartmentId } = req.params;

        // Check if the apartment exists and is owned by the user
        const apartment = await Apartment.findOne({ _id: apartmentId, userId: req.user.id });

        if (!apartment) {
            return res.status(404).json({ error: "Apartment listing not found or unauthorized." });
        }

        // If already active
        if (apartment.isAvailable) {
            return res.status(400).json({ error: "Apartment listing is already active." });
        }

        // Reactivate the apartment
        apartment.isAvailable = true;
        const updatedApartment = await apartment.save();

        res.status(200).json({
            message: "Apartment listing has been successfully reactivated.",
            updatedApartment,
        });
    } catch (err) {
        console.error("Error reactivating apartment listing:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// GET ALL USER (Agent / Landlord) DEACTIVATED APARTMENT LISTINGS
router.get("/deactivated", verifyUserToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        //  Use the correct field for user match: userId
        const filter = { userId: req.user.id, isAvailable: false };

        const total = await Apartment.countDocuments(filter);
        
        const userDeactivatedListings = await Apartment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        res.status(200).json({
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalListings: total,
            listingsPerPage: limit,
            hasMore: skip + userDeactivatedListings.length < total,
            listings: userDeactivatedListings,
        });
    } catch (err) {
        console.error("Error fetching deactivated apartments:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




// SEARCH USER'S DEACTIVATED APARTMENTS (isAvailable: false only)
router.get("/search/deactivated", verifyUserToken, async (req, res) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;
        const userId = req.user.id;

        if (!query) {
            return res.status(400).json({ error: "Search query is required." });
        }

        // Fetch user's listings and populate the referenced apartments
        const userPosts = await UserPost.findOne({ userId }).populate("apartment_listings.ApartmentId");

        if (!userPosts || userPosts.apartment_listings.length === 0) {
            return res.status(404).json({ error: "You have no posted apartments." });
        }

        // Filter by query + isAvailable === false
        const deactivatedListings = userPosts.apartment_listings.filter((listing) => {
            const apt = listing.ApartmentId;
            if (!apt || apt.isAvailable) return false;

            return (
                apt.title?.toLowerCase().includes(query.toLowerCase()) ||
                apt.apartment_address?.toLowerCase().includes(query.toLowerCase())
            );
        });

        const totalResults = deactivatedListings.length;
        const listingsPerPage = parseInt(limit);
        const currentPage = parseInt(page);
        const totalPages = Math.ceil(totalResults / listingsPerPage);

        const paginatedResults = deactivatedListings
        .slice((currentPage - 1) * listingsPerPage, currentPage * listingsPerPage)
        .map((listing) => listing.ApartmentId);
        if (paginatedResults.length === 0) {
            return res.status(404).json({ error: "No matching deactivated apartments found on this page." });
        }

        res.status(200).json({
            message: "Matching deactivated apartments retrieved successfully.",
            currentPage,
            totalPages,
            totalResults,
            listingsPerPage,
            results: paginatedResults,
        });
    } catch (err) {
        console.error("Error searching deactivated listings:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
    }
});





export default router;