import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ✅ Allow your frontend domain
const allowedOrigins = [
  "http://localhost:5173", // local dev
  "https://superapp-frontend.onrender.com", // your Render frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get("/healthz", (req, res) => {
  res.send("OK");
});

// Example API
app.get("/", (req, res) => {
  res.json({ message: "SuperApp backend is live 🚀" });
});

export default app;

