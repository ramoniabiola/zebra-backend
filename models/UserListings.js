import mongoose from "mongoose";


const UserListingsSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        
        apartment_listings: [
            {
                ApartmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Apartment", required: true },
                postedAt: { type: Date, default: Date.now } // Tracks when the Apartment was posted.
            }
        ],  
    },
    { timestamps: true }
);


export default mongoose.model("UserListings", UserListingsSchema);
