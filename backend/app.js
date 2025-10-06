import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Allow requests from your Render frontend URL
app.use(
  cors({
    origin: ["http://localhost:5173", "https://superapp-frontend.onrender.com"],
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is running and CORS is configured!");
});

export default app;

