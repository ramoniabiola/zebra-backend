import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";



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


//STATIC "sign-up" METHOD
UserSchema.statics.signup = async function(password, userData) {

    // Validation
    if (!validator.isEmail(userData.email)) {
        throw new Error('Invalid email!, please provide a valid email....');
    }

    if (!validator.isStrongPassword(password)) {
        throw new Error('Password not strong enough...');
    }

    // Check if email already exists
    const exists = await this.findOne({ email: userData.email });
    if (exists) {
        throw new Error('Email already in use...');
    }

    // Password hashing
    const salt = await bcrypt.genSalt(10); // Generate salt
    const hashedPassword = await bcrypt.hash(password, salt); // Hash password


    // Create user
    const user = await this.create({ ...userData, password: hashedPassword });

    return user;
};




// STATIC "login" METHOD
UserSchema.statics.login = async function(username, password) {


    if (!username || !password) {
        throw Error('All fields must be filled...');
    }

    const user = await this.findOne({ username });

    if (!user) {
        throw Error('Incorrect username...');
    }       

    // Ensure user object is valid before accessing password property
    if (!user.password) {
        throw Error('User object is missing password field...');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if(!isMatch) {
        throw Error('Incorrect password')
    }

    return user;
};



export default  mongoose.model("User", UserSchema);
