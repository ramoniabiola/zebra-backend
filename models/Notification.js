import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true }, // recipient
    role: { type: String, enum: ["tenant", "landlord", "agent"], required: true },
    message: { type: String, required: true },
    meta: {
      apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Apartment" },
      location: String,
      title:  String, 
    },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
