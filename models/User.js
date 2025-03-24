import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        full_name: { type: String, required: true }, 
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true }, 
        phone_no: { type: String },
        gender: { type: String },
        profile_picture: { type: String },
        address: { type: String },
        date_of_birth: { type: Date },
        role: { type: String, enum: ["tenant", "landlord", "agent"], required: true },
        verified: { type: Boolean, default: false },
        account_status: { type: String, enum: ["active", "banned", "pending"], default: "active" },
        preferred_locations: [{ type: String }]
    },
    { timestamps: true }
);

export default  mongoose.model("User", UserSchema);
