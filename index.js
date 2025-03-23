import express from "express";
import cors from "cors";
import dotenv from "dotenv";


const app = express();

// Use cors middleware
app.use(cors());


dotenv.config();


app.use(express.json());


app.listen(process.env.PORT, () => {
    console.log("Backend server is running...")
});