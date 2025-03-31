const ReportLogSchema = new mongoose.Schema(
    {
        apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Apartment", required: true },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
        reason: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }, // When the report was made
        status: { type: String, enum: ["pending", "reviewed", "resolved"], default: "pending" }, 
        resolvedAt: { type: Date }, // When the report was resolved
    },
    { timestamps: true }
);

export default mongoose.model("ReportLog", ReportLogSchema);
