import express from "express";
import cors from "cors"
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";


// instantiate dotenv
dotenv.config();

// Start Express.js
const app = express();

// Server Creation
const server = http.createServer(app)

// Use cors middleware
app.use(cors());


// Database Connection
mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 5000, 
})
.then(() => console.log("DB connection successful..."))
.catch((err) => console.error("Database connection error:", err));


// Server listening port
server.listen(process.env.PORT, () => {
    console.log(`Backend server is running...`)
});