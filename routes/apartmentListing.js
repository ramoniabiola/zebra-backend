import { Router } from "express";
import Apartment from "../models/Apartment.js";
import UserListings from "../models/UserListings.js";
import ReportLog from "../models/ReportLog.js";
import verifyUserToken from "../middlewares/verifyUserToken.js";
import verifyAdminToken from "../middlewares/verifyAdminToken.js";
import verifyTenantToken from "../middlewares/verifyTenantToken.js";
import logAdminAction from "../middlewares/logAdminAction.js";
import moment from "moment"; 
import ViewLog from "../models/ViewLog.js"; 
import { getClientIp } from "request-ip"; // To get user IP address
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { createAndEmitNotification } from "../services/notificationService.js";



const router = Router();


const storage = multer.memoryStorage();
const upload = multer({ storage });


// APARTMENT IMAGES UPLOAD - Optimized
router.post("/upload", upload.array("images"), async (req, res) => {
    try {
        const uploadedImages = [];
        
        if (req.files.length > 15) {
          return res.status(400).json({ error: "Maximum 15 images allowed." });
        }

        for (const file of req.files) {
            const uploaded = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "apartments", // optional: organize your uploads
                        transformation: [
                            { width: 1280, crop: "limit" }, // resize max width to 1280
                            { quality: "auto" }             // smart compression
                        ],
                        resource_type: "image"
                    },
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    }
                );
                stream.end(file.buffer);
            });

            uploadedImages.push(uploaded.secure_url); // Store optimized version URL
        }

        res.json({ uploadedImages });
    } catch (err) {
        console.error("Image upload error:", err);
        res.status(500).json({ 
            error: "Image upload failed",
            message: err.message,
        });
    }
});




// CREATE AN APARTMENT LISTING (Only for Landlords & Agents)
router.post("/create", verifyUserToken, async (req, res) => {
    try {
        // Create new apartment listing
        const newListing = new Apartment({
            ...req.body,
            userId: req.user.id, // Attach user ID from token
        });

        // Save the new apartment to the database
        const savedListing = await newListing.save();

        // 🔁 Add listing to UserPost tracker
        await UserListings.findOneAndUpdate(
            { userId: req.user.id },
            {
                $push: {
                    apartment_listings: {
                        ApartmentId: savedListing._id,
                        postedAt: savedListing.createdAt,
                    },
                },
            },
            { upsert: true, new: true }
        );

        // Notify the owner (landlord or agent)
        await createAndEmitNotification({
            userId: req.user.id,
            role: req.user.role, // "landlord" or "agent"
            message: "🏡 Your apartment has been successfully listed.",
            meta: { apartmentId: savedListing._id, title: savedListing.title, location: savedListing.location },
        });


        // Return the saved apartment
        res.status(201).json(savedListing);
    } catch (err) {
        res.status(500).json({
            error: "Failed to create apartment listing",
            message: err.message,
        });
    }
});



// Admin-only Delete Route
router.delete("/admin/delete/:id", verifyAdminToken, async (req, res) => {
    try {

        const adminId = req.user.id;  // Authenticated admin performing the action
        const { id } = req.params;

        const listing = await Apartment.findById(id);

        if (!listing) {
            return res.status(404).json({ error: "Apartment not found." });
        }

        await Apartment.findByIdAndDelete(id);

        // Log Admin Apartment listing Deletion with Timestamp
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        await logAdminAction(adminId, `[${timestamp}]: ${adminId} deleted Apartment listing-${listing.title}`, listing.id);

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


// GET ALL AVAILABLE APARTMENT LISTINGS (paginated approach to apartment listings)
router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
        const skip = (page - 1) * limit;
        const sortBy = req.query.sortBy || "recent";
        
        const match = { isAvailable: true };
        const total = await Apartment.countDocuments(match);
        
        // start pipeline
        let pipeline = [{ $match: match }];
        
        if (sortBy === "recent") {
            pipeline.push({
                $addFields: {
                    sortDate: {
                        $cond: {
                            if: { $eq: ["$createdAt", "$updatedAt"] },
                            then: "$createdAt",
                            else: "$updatedAt",
                        },
                    },
                },
            });

            pipeline.push({ $sort: { sortDate: -1 } });
        } else if (sortBy === "random") {
            // Use $rand + $sort so we can paginate with $skip/$limit
            pipeline.push({ $addFields: { randomSort: { $rand: {} } } });
            pipeline.push({ $sort: { randomSort: 1 } });
        } else if (sortBy === "popular") {

            // build orderedLocations first
            const locationFrequency = await Apartment.aggregate([
                { $match: match },
                { $group: { _id: "$location", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]);
            const orderedLocations = locationFrequency.map((l) => l._id);
            pipeline.push({
                $addFields: {
                    locationOrder: { $indexOfArray: [orderedLocations, "$location"] },
                },
            });
            pipeline.push({ $sort: { locationOrder: 1 } });
        }
      
        // finally apply skip + limit (always)
        pipeline.push({ $skip: skip }, { $limit: limit });
      
        const listings = await Apartment.aggregate(pipeline);
      
        return res.status(200).json({
            listings,
            total,
            hasMore: skip + listings.length < total,
        });
    } catch (err) {
        console.error("Error fetching apartment listings:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});


// SEARCH APARTMENT LISTINGS(search query) 
router.get("/search", async (req, res) => {
    try {
        
        // Handle both named parameters and a general 'q' parameter
        let {
            location,
            apartment_type,
            max_price,
            min_price,
            bedrooms,
            keyword,
            q, // General search parameter
            page = 1,
            limit = 10,
        } = req.query;


        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;


        // If 'q' is provided but no specific keyword, use 'q' as keyword
        if (q && !keyword) {
            keyword = q;
        }

        const query = {};
        let sortObj = {};


        // Enhanced search parsing for multi-word queries
        if ((keyword && keyword.trim()) || (q && q.trim())) {
            const searchTerm = (keyword || q).trim().toLowerCase();
            
            // Parse the search term for specific patterns
            const parsedSearch = parseSearchTerm(searchTerm);
            
            // Build the query based on parsed terms
            const searchConditions = [];
            
            // If we extracted specific filters, apply them
            if (parsedSearch.bedrooms && !bedrooms) {
                query.bedrooms = parsedSearch.bedrooms;
            }
            
            if (parsedSearch.apartmentType && !apartment_type) {
                query.apartment_type = { $regex: new RegExp(parsedSearch.apartmentType, "i") };
            }
            
            // Always search across text fields with remaining terms or full term
            const searchTermsForText = parsedSearch.remainingTerms.length > 0 
                ? parsedSearch.remainingTerms.join(' ') 
                : searchTerm;
                
            if (searchTermsForText) {
                searchConditions.push(
                    { title: { $regex: new RegExp(searchTermsForText, "i") } },
                    { description: { $regex: new RegExp(searchTermsForText, "i") } },
                    { location: { $regex: new RegExp(searchTermsForText, "i") } }
                );
                
                // Also search for individual words in the term
                const words = searchTermsForText.split(/\s+/);
                if (words.length > 1) {
                    words.forEach(word => {
                        if (word.length > 2) { // Skip very short words
                            searchConditions.push(
                                { location: { $regex: new RegExp(word, "i") } },
                                { title: { $regex: new RegExp(word, "i") } },
                                { description: { $regex: new RegExp(word, "i") } }
                            );
                        }
                    });
                }
            }
            
            if (searchConditions.length > 0) {
                query.$or = searchConditions;
            }
        }

        // Helper function to parse search terms
        function parseSearchTerm(searchTerm) {
            const result = {
                bedrooms: null,
                apartmentType: null,
                remainingTerms: []
            };
            
            const words = searchTerm.split(/\s+/);
            const processedWords = new Set();
            
            // Bedroom patterns
            const bedroomPatterns = [
                /(\d+)[-\s]?bedroom?s?/i,
                /(\d+)[-\s]?bed/i,
                /(\d+)[-\s]?br/i,
                /(one|two|three|four|five|six|1|2|3|4|5|6)[-\s]?bedroom?s?/i,
                /(studio)/i
            ];
            
            // Apartment type patterns
            const apartmentTypePatterns = [
                /(studio|mini[\s-]?flat|self[\s-]?con|self[\s-]?contained|duplex|penthouse|bungalow)/i,
                /(flat|apartment)/i
            ];
            
            // Check for bedroom patterns
            for (const pattern of bedroomPatterns) {
                const match = searchTerm.match(pattern);
                if (match) {
                    if (match[1].toLowerCase() === 'studio') {
                        result.bedrooms = 0; // Studio = 0 bedrooms
                    } else {
                        const bedroomCount = convertWordToNumber(match[1].toLowerCase());
                        if (bedroomCount !== null) {
                            result.bedrooms = bedroomCount;
                        }
                    }
                    // Mark the matched words as processed
                    words.forEach((word, index) => {
                        if (match[0].toLowerCase().includes(word.toLowerCase())) {
                            processedWords.add(index);
                        }
                    });
                    break;
                }
            }
            
            // Check for apartment type patterns
            for (const pattern of apartmentTypePatterns) {
                const match = searchTerm.match(pattern);
                if (match) {
                    result.apartmentType = match[1];
                    // Mark the matched words as processed
                    words.forEach((word, index) => {
                        if (match[0].toLowerCase().includes(word.toLowerCase())) {
                            processedWords.add(index);
                        }
                    });
                    break;
                }
            }
            
            // Collect remaining unprocessed words
            words.forEach((word, index) => {
                if (!processedWords.has(index) && word.length > 1) {
                    result.remainingTerms.push(word);
                }
            });
            
            return result;
        }
        
        // Helper function to convert word numbers to digits
        function convertWordToNumber(word) {
            const numberMap = {
                'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
                '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
            };
            return numberMap[word] || null;
        }

        // Location filter (only if no keyword or keyword doesn't cover location)
        if (location && location.trim()) {
            if (!keyword) {
                query.location = { $regex: new RegExp(location.trim(), "i") };
            } else {
                // Add location as additional filter even with keyword
                query.location = { $regex: new RegExp(location.trim(), "i") };
            }
        }

        // Apartment type filter
        if (apartment_type && apartment_type.trim()) {
            query.apartment_type = { $regex: new RegExp(apartment_type.trim(), "i") };
        }

        // Bedrooms filter
        if (bedrooms) {
            const bedroomCount = parseInt(bedrooms);
            if (!isNaN(bedroomCount)) {
                query.bedrooms = bedroomCount;
            }
        }

        // Price range filter
        if (min_price || max_price) {
            query.price = {};
            if (min_price) {
                const minPriceNum = parseInt(min_price);
                if (!isNaN(minPriceNum)) {
                    query.price.$gte = minPriceNum;
                }
            }
            if (max_price) {
                const maxPriceNum = parseInt(max_price);
                if (!isNaN(maxPriceNum)) {
                    query.price.$lte = maxPriceNum;
                }
            }
        }

        // Build sort object
        if (keyword && keyword.trim()) {
            // For keyword searches, sort by creation date (most recent first)
            sortObj.createdAt = -1;
        } else if (max_price || min_price) {
            sortObj.price = min_price ? 1 : -1;
        } else if (bedrooms) {
            sortObj.bedrooms = 1;
        } else {
            sortObj.createdAt = -1;
        }

        const skip = (page - 1) * limit;

        // Count total docs for pagination info
        const totalCount = await Apartment.countDocuments({
          ...query,
          isAvailable: true,
        });
        
        const listings = await Apartment.find({
            ...query,
            isAvailable: true
        })
        .sort(sortObj)
        .skip(skip)
        .limit(limit);


        // If Apartment not found, return 404 Not Found
        if (listings.length === 0) {
            return res.status(404).json({
                error: "No apartments found for your search.",
                total: 0,
                page,
                totalPages: 0,
                hasNextPage: false,
            });
        }

        res.status(200).json({
            results: listings,
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            hasNextPage: page * limit < totalCount,
            hasPrevPage: page > 1,
        });
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




// REPORT AN APARTMENT LISTING
router.post("/report/:id", verifyTenantToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        if (!reason) {
            return res.status(400).json({ error: "Please provide a reason for reporting." });
        }

        // Check if apartment exists
        const apartment = await Apartment.findById(id);
        if (!apartment) {
            return res.status(404).json({ error: "Apartment not found." });
        }

        // Check if user has already reported this apartment
        const existingReport = await ReportLog.findOne({ apartmentId: id, reportedBy: userId });
        if (existingReport) {
            return res.status(400).json({ error: "You have already reported this apartment." });
        }

        // Create a new report
        const newReport = new ReportLog({
            apartmentId: id,
            reportedBy: userId,
            reason,
        });

        await newReport.save();

        // Update apartment report count
        apartment.reportCount += 1;
        await apartment.save();

        res.status(201).json({ message: "Apartment reported successfully.", report: newReport });
    } catch (err) {
        console.error("Error reporting apartment:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




export default router;