import mongoose from "mongoose";

const ViewLogSchema = new mongoose.Schema(
    {
        apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Apartment", required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // If user is logged in
        userIp: { type: String, required: true }, // For tracking guest views
    },
    { timestamps: true } // Automatically adds createdAt timestamp
);

export default mongoose.model("ViewLog", ViewLogSchema);
