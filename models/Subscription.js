import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        plan: { type: String, required: true, enum: ["free", "basic", "premium"] },
        price: { type: Number, required: true },
        status: { type: String, enum: ["active", "expired"], default: "active" },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);



export default mongoose.model("Subscription", SubscriptionSchema);
