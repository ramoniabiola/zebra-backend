import mongoose from "mongoose";

const UserBookmarkSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        products: [
            {
                productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
            }
        ],
    },
    { timestamps: true }
);

export default mongoose.model("UserBookmark", UserBookmarkSchema);
