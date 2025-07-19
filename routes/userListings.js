import { Router } from "express";
import UserListings from "../models/UserListings.js";
import Apartment from "../models/Apartment.js"
import verifyUserToken from "../middlewares/verifyUserToken.js"


const router = Router();

// GET ALL ACTIVE APARTMENT LISTINGS POSTED BY A USER
router.get("/:userId", verifyUserToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        if (req.user.id !== userId) {
            return res.status(403).json({ error: "Forbidden: You can only view your own listings." });
        }

        const userListings = await UserListings.findOne({ userId }).populate("apartment_listings.ApartmentId");

        if (!userListings) {
            return res.status(404).json({ error: "No listings found for this user." });
        }

        const activeListings = userListings.apartment_listings.filter(
            (listing) => listing.ApartmentId && listing.ApartmentId.isAvailable
        );

        if (!activeListings || activeListings.length === 0) {
            return res.status(200).json({
                message: "No active apartment listings found.",
                currentPage: Number(page),
                totalPages: 0,
                totalListings: 0,
                listingsPerPage: Number(limit),
                apartments: [],
            });
        }


        activeListings.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));


        const totalListings = activeListings.length;
        const totalPages = Math.ceil(totalListings / limit);
        const paginatedListings = activeListings.slice((page - 1) * limit, page * limit);
        const apartments = paginatedListings.map((listing) => listing.ApartmentId);

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



// GET A SPECIFIC ACTIVE APARTMENT LISTING POSTED BY A USER(Agent / Landlord)
router.get("/:userId/apartment/:apartmentId", verifyUserToken, async (req, res) => {
    try {
        const { userId, apartmentId } = req.params;

        // Check if the authenticated user is requesting their own listing
        if (req.user.id !== userId) {
            return res.status(403).json({ error: "Forbidden: You can only view your own listings." });
        }

        // Find the user's listings
        const userListings = await UserListings.findOne({ userId }).populate("apartment_listings.ApartmentId");

        if (!userListings) {
            return res.status(404).json({ error: "No listings found for this user." });
        }

        // Find the specific apartment listing
        const specificListing = userListings.apartment_listings.find(
            (listing) => listing.ApartmentId && 
                listing.ApartmentId._id.toString() === apartmentId &&
                listing.ApartmentId.isAvailable
        );

        if (!specificListing) {
            return res.status(404).json({ 
                error: "Apartment listing not found or not available." 
            });
        }

        res.status(200).json(specificListing.ApartmentId);

    } catch (err) {
        console.error("Error fetching specific apartment listing:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
    }
});


// SEARCH USER'S ACTIVE APARTMENTS (isAvailable: true only)
router.get("/search/active", verifyUserToken, async (req, res) => {
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

        // Fetch the user's listings and populate apartments
        const userListings = await UserListings.findOne({ userId })
            .populate({
                path: "apartment_listings.ApartmentId"
            })
            .lean();

        if (!userListings || userListings.apartment_listings.length === 0) {
            return res.status(404).json({ 
                message: "You have no posted apartments.",
                totalResults: 0,
                currentPage: pageNumber,
                totalPages: 0,
                listings: []
            });
        }

        // Filter active listings (isAvailable: true) and remove deleted apartments
        let filteredListings = userListings.apartment_listings.filter(listing => 
            listing.ApartmentId && listing.ApartmentId.isAvailable
        );

        // Sort by newest first (using postedAt or createdAt)
        filteredListings.sort((a, b) => {
            const dateA = new Date(a.postedAt || a.ApartmentId.createdAt);
            const dateB = new Date(b.postedAt || b.ApartmentId.createdAt);
            return dateB - dateA;
        });

        // Apply search filters
        if (keyword && keyword.trim()) {
            const searchTerm = keyword.trim().toLowerCase();
            filteredListings = filteredListings.filter(listing => {
                const apt = listing.ApartmentId;
                return (
                    apt.title?.toLowerCase().includes(searchTerm) ||
                    apt.description?.toLowerCase().includes(searchTerm) ||
                    apt.location?.toLowerCase().includes(searchTerm) ||
                    apt.apartment_address?.toLowerCase().includes(searchTerm) ||
                    apt.apartment_type?.toLowerCase().includes(searchTerm)
                );
            });
        }

        // Apply specific filters
        if (title && title.trim()) {
            filteredListings = filteredListings.filter(listing =>
                listing.ApartmentId.title?.toLowerCase().includes(title.toLowerCase())
            );
        }

        if (location && location.trim()) {
            filteredListings = filteredListings.filter(listing =>
                listing.ApartmentId.location?.toLowerCase().includes(location.toLowerCase()) ||
                listing.ApartmentId.apartment_address?.toLowerCase().includes(location.toLowerCase())
            );
        }

        if (apartment_type && apartment_type.trim()) {
            filteredListings = filteredListings.filter(listing =>
                listing.ApartmentId.apartment_type?.toLowerCase().includes(apartment_type.toLowerCase())
            );
        }

        if (bedrooms) {
            const bedroomCount = parseInt(bedrooms);
            if (!isNaN(bedroomCount)) {
                filteredListings = filteredListings.filter(listing =>
                    listing.ApartmentId.bedrooms === bedroomCount
                );
            }
        }

        // Price range filters
        if (min_price || max_price) {
            filteredListings = filteredListings.filter(listing => {
                const price = listing.ApartmentId.price;
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
                message: "No matching active apartments found.",
                totalResults: 0,
                currentPage: pageNumber,
                totalPages: 0,
                listings: []
            });
        }

        // Apply pagination
        const paginatedListings = filteredListings.slice(skip, skip + pageSize);

        // Extract apartment data and include posting information
        const results = paginatedListings.map(listing => ({
            ...listing.ApartmentId,
            postedAt: listing.postedAt
        }));

        // Return results
        res.status(200).json({
            success: true,
            message: "Matching active apartments retrieved successfully.",
            totalResults: filteredListings.length,
            currentPage: pageNumber,
            totalPages: Math.ceil(filteredListings.length / pageSize),
            listingsPerPage: pageSize,
            hasNextPage: pageNumber < Math.ceil(filteredListings.length / pageSize),
            hasPrevPage: pageNumber > 1,
            listings: results,
        });

    } catch (err) {
        console.error("Error searching active listings:", err);
        res.status(500).json({ 
            error: "Internal server error",
            message: err.message 
        });
    }
});


// GET USER DASHBOARD LISTING METRICS
router.get("/count/dashboard", verifyUserToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Run all 3 counts in parallel for speed
    const [userListingsDoc, activeCount, deactivatedCount] = await Promise.all([
        UserListings.findOne({ userId }), // To get total listings posted (based on history)
        Apartment.countDocuments({ userId, isAvailable: true }),
        Apartment.countDocuments({ userId, isAvailable: false }),
    ]);

    const totalListings = userListingsDoc?.apartment_listings?.length || 0;

    res.status(200).json({
      totalListings,
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



// GET ALL DEACTIVATED APARTMENT LISTINGS POSTED BY A USER(Agent/Landlord)
router.get("/deactivated/:userId", verifyUserToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        if (req.user.id !== userId) {
            return res.status(403).json({ error: "Forbidden: You can only view your own listings." });
        }

        const userListings = await UserListings.findOne({ userId }).populate("apartment_listings.ApartmentId");

        if (!userListings) {
            return res.status(404).json({ error: "No listings found for this user." });
        }

        // Filter: only deactivated listings (isAvailable === false)
        const deactivatedListings = userListings.apartment_listings.filter(
            (listing) => listing.ApartmentId && !listing.ApartmentId.isAvailable
        );

        if (!deactivatedListings || deactivatedListings.length === 0) {
            return res.status(200).json({
                message: "No deactivated apartment listings found.",
                currentPage: Number(page),
                totalPages: 0,
                totalListings: 0,
                listingsPerPage: Number(limit),
                apartments: [],
            });
        }

        // Sort by postedAt (descending)
        deactivatedListings.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

        // Pagination
        const totalListings = deactivatedListings.length;
        const totalPages = Math.ceil(totalListings / limit);
        const paginatedListings = deactivatedListings.slice((page - 1) * limit, page * limit);
        const apartments = paginatedListings.map((listing) => listing.ApartmentId);

        res.status(200).json({
            message: "Deactivated apartment listings fetched successfully.",
            currentPage: Number(page),
            totalPages,
            totalListings,
            listingsPerPage: Number(limit),
            apartments,
        });
    } catch (err) {
        console.error("Error fetching deactivated listings:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
    }
});



// SEARCH USER'S DEACTIVATED APARTMENTS (isAvailable: false only)
router.get("/search/deactivated", verifyUserToken, async (req, res) => {
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

        // Fetch the user's listings and populate apartments
        const userListings = await UserListings.findOne({ userId })
            .populate({
                path: "apartment_listings.ApartmentId"
            })
            .lean();

        if (!userListings || userListings.apartment_listings.length === 0) {
            return res.status(404).json({ 
                message: "You have no posted apartments.",
                totalResults: 0,
                currentPage: pageNumber,
                totalPages: 0,
                listings: []
            });
        }

        // Filter deactivated listings (isAvailable: false) and remove deleted apartments
        let filteredListings = userListings.apartment_listings.filter(listing => 
            listing.ApartmentId && !listing.ApartmentId.isAvailable
        );

        // Sort by newest first (using postedAt or createdAt)
        filteredListings.sort((a, b) => {
            const dateA = new Date(a.postedAt || a.ApartmentId.createdAt);
            const dateB = new Date(b.postedAt || b.ApartmentId.createdAt);
            return dateB - dateA;
        });

        // Apply search filters
        if (keyword && keyword.trim()) {
            const searchTerm = keyword.trim().toLowerCase();
            filteredListings = filteredListings.filter(listing => {
                const apt = listing.ApartmentId;
                return (
                    apt.title?.toLowerCase().includes(searchTerm) ||
                    apt.description?.toLowerCase().includes(searchTerm) ||
                    apt.location?.toLowerCase().includes(searchTerm) ||
                    apt.apartment_address?.toLowerCase().includes(searchTerm) ||
                    apt.apartment_type?.toLowerCase().includes(searchTerm)
                );
            });
        }

        // Apply specific filters
        if (title && title.trim()) {
            filteredListings = filteredListings.filter(listing =>
                listing.ApartmentId.title?.toLowerCase().includes(title.toLowerCase())
            );
        }

        if (location && location.trim()) {
            filteredListings = filteredListings.filter(listing =>
                listing.ApartmentId.location?.toLowerCase().includes(location.toLowerCase()) ||
                listing.ApartmentId.apartment_address?.toLowerCase().includes(location.toLowerCase())
            );
        }

        if (apartment_type && apartment_type.trim()) {
            filteredListings = filteredListings.filter(listing =>
                listing.ApartmentId.apartment_type?.toLowerCase().includes(apartment_type.toLowerCase())
            );
        }

        if (bedrooms) {
            const bedroomCount = parseInt(bedrooms);
            if (!isNaN(bedroomCount)) {
                filteredListings = filteredListings.filter(listing =>
                    listing.ApartmentId.bedrooms === bedroomCount
                );
            }
        }

        // Price range filters
        if (min_price || max_price) {
            filteredListings = filteredListings.filter(listing => {
                const price = listing.ApartmentId.price;
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
                message: "No matching deactivated apartments found.",
                totalResults: 0,
                currentPage: pageNumber,
                totalPages: 0,
                listings: []
            });
        }

        // Apply pagination
        const paginatedListings = filteredListings.slice(skip, skip + pageSize);

        // Extract apartment data and include posting information
        const results = paginatedListings.map(listing => ({
            ...listing.ApartmentId,
            postedAt: listing.postedAt
        }));

        // Return results
        res.status(200).json({
            success: true,
            message: "Matching deactivated apartments retrieved successfully.",
            totalResults: filteredListings.length,
            currentPage: pageNumber,
            totalPages: Math.ceil(filteredListings.length / pageSize),
            listingsPerPage: pageSize,
            hasNextPage: pageNumber < Math.ceil(filteredListings.length / pageSize),
            hasPrevPage: pageNumber > 1,
            listings: results,
        });

    } catch (err) {
        console.error("Error searching deactivated listings:", err);
        res.status(500).json({ 
            error: "Internal server error",
            message: err.message 
        });
    }
});



export default router;