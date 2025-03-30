import mongoose from "mongoose";



const ApartmentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        apartment_type: { 
            type: String, 
            required: true, 
            enum: ["self-contained", "1-bedroom", "2-bedroom", "3-bedroom", "duplex", "studio", "shared-apartment"] 
        },
        price: { type: Number, required: true },
        payment_frequency: { type: String, enum: ["monthly", "quarterly", "yearly"], required: true },
        duration: { type: String, required: true },
        location: { type: String, required: true },
        apartment_address: { type: String, required: true },
        nearest_landmark: { type: String },
        images: [{ type: String, required: true }],
        contact_phone: { type: String, required: true },
        isAvailable: { type: Boolean, default: true },
        apartment_amenities: { type: String },    
        bedrooms: { type: Number, required: true },
        bathrooms: { type: Number, required: true },
        apartmen_size: { type: String },
        furnished: { type: Boolean, default: false },
        service_charge: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        verified_listing: { type: Boolean, default: false },
    },
    { timestamps: true }
);
 


export default mongoose.model("Apartment", ApartmentSchema);
