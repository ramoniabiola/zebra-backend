import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";



const UserAdminSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["superadmin", "moderator"], default: "moderator" }, // Different admin roles
    createdAt: { type: Date, default: Date.now },
});



//STATIC METHOD TO "sign-up" Admin 
UserAdminSchema.statics.signup = async function(userAdminData) {

    const { email, password, name } = userAdminData; // Extract password from userAdminData

    try {
        // Validation
        if (!validator.isEmail(email)) {
            throw new Error('Invalid email!, please provide a valid email....');
        }

        if (!validator.isStrongPassword(password)) {
            throw new Error('Password not strong enough...');
        }


        // Check if email or name already exists
        const existingUser = await this.findOne({
            $or: [{ email }, { name }]  
        });

        if (existingUser) {
            throw new Error("Name or Email already in use...");
        }

        // Password hashing
        const salt = await bcrypt.genSalt(10); // Generate salt
        const hashedPassword = await bcrypt.hash(password, salt); // Hash password


        // Create user 
        const userAdmin = await this.create({ ...userAdminData, password: hashedPassword });

        return userAdmin;
    } catch(error) {
        throw new Error(error.message);
    }
};



//STATIC METHOD TO "login" Admin
UserAdminSchema.statics.login = async function(email, password) {
    
    try {
        if (!email || !password) {
            throw Error('All fields must be filled...');
        }
    
        const userAdmin = await this.findOne({ email });
    
        if (!userAdmin) {
            throw Error('Incorrect email...');
        }       
    
        // Ensure userAdmin object is valid before accessing password property
        if (!userAdmin.password) {
            throw Error('Admin object is missing password field...');
        }
    
        const isMatch = await bcrypt.compare(password, userAdmin.password);
    
        if(!isMatch) {
            throw Error('Incorrect password')
        }
    
        return userAdmin;
    } catch(error) {
        throw new Error(error.message);
    }
};


export default mongoose.model("UserAdmin", UserAdminSchema);