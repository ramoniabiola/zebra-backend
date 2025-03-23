import mongoose from "mongoose";

const UserPostSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        products: [
            {
                productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
                postedAt: { type: Date, default: Date.now } // Tracks when the product was posted
            }
        ],  
    },
    { timestamps: true }
);

export default mongoose.model("UserPost", UserPostSchema);
