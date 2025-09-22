import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true }, 
    role: { type: String, enum: ["tenant", "landlord", "agent"], required: true },
    message: { type: String, required: true },
    meta: {
      apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Apartment" },
      location: String,
      title: String,
    },
    isRead: { type: Boolean, default: false, index: true },

    // Auto-delete after a month (TTL index)
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

// TTL index on expiresAt
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Notification", notificationSchema);
