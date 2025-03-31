import mongoose from "mongoose";

const AdminLogSchema = new mongoose.Schema(
    {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "UserAdmin", required: true }, // Reference to Admin
        action: { type: String, required: true }, // Description of action performed
        target: { type: String }, // ID or details of the affected user/listing/review
        ipAddress: { type: String }, // IP address of the admin
        timestamp: { type: Date, default: Date.now }, // When the action occurred
    },
    { timestamps: true }
);

export default mongoose.model("AdminLog", AdminLogSchema);
