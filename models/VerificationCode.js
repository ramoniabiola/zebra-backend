import mongoose from 'mongoose';

const codeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
});

export default mongoose.model('VerificationCode', codeSchema);
