import mongoose from "mongoose";

const UserBookmarkSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        apartment_listings: [
            {
                apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Apartment", required: true },
            }
        ],
    },
    { timestamps: true }
);

export default mongoose.model("UserBookmark", UserBookmarkSchema);
