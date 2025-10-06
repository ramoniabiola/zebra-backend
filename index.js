import dotenv from 'dotenv';

dotenv.config(); // Load env first

// Libraries / Dependencies
import express from "express";
import cors from "cors"
import mongoose from "mongoose"; 
import http from "http";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";

// Routes
import adminAuthRoute from "./routes/adminAuth.js";
import userAdminRoute from "./routes/userAdmin.js";
import userAuthRoute from "./routes/userAuth.js";
import userRoute from "./routes/user.js";
import apartmentListingRoute from "./routes/apartmentListing.js";
import userBookmarkRoute from "./routes/userBookmark.js";
import userListingsRoute from "./routes/userListings.js";
import notificationRoute from "./routes/notification.js";


// Start Express.js
const app = express();

// Enable cookie parsing
app.use(cookieParser());

// Server Creation
const server = http.createServer(app)

// Use cors middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://zebra-frontend-liart.vercel.app",
  ],
  credentials: true, // Allow credentials (cookies, etc.)
}));


const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://zebra-frontend-liart.vercel.app",
    ],
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  }
});



// Database Connection
mongoose.connect(process.env.MONGO_URL, {
  serverSelectionTimeoutMS: 30000, 
})
.then(() => console.log("DB connection successful..."))
.catch((err) => console.error("Database connection error:", err));


// USE EXPRESS.JSON MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API ROUTES
app.use("/api/admin/auth", adminAuthRoute)
app.use("/api/admin", userAdminRoute)
app.use("/api/user/auth", userAuthRoute)
app.use("/api/user", userRoute)
app.use("/api/apartments", apartmentListingRoute)
app.use("/api/bookmarks", userBookmarkRoute)
app.use("/api/user-listings", userListingsRoute)
app.use("/api/notifications", notificationRoute);




// Server listening port
server.listen(process.env.PORT, () => {
  console.log(`Backend server is running...`)
}); 



// Store connected users
const onlineUsers = new Map();


io.on("connection", (socket) => {
  
  socket.on("registerUser", (userId) => { 
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    socket.data.userId = userId;
  });
 
  
  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (userId && onlineUsers.has(userId)) {
      const set = onlineUsers.get(userId);
      set.delete(socket.id);
      if (set.size === 0) onlineUsers.delete(userId);
    }
  });
});

export { app, server, io, onlineUsers };