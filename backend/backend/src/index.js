import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;

// ✅ Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.RATE_LIMIT_MAX || 150 }));

// ✅ Auth middleware
const auth = (req, res, next) => {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "Missing Authorization header" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid Authorization format" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { userId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ✅ Superadmin check middleware
const requireSuperadmin = (req, res, next) => {
  if (req.user.role !== "SUPERADMIN" || req.user.email !== SUPERADMIN_EMAIL) {
    return res.status(403).json({ error: "Only superadmin can perform this action" });
  }
  next();
};

// ✅ Prevent superadmin delete/edit
const protectSuperadmin = async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (user && user.email === SUPERADMIN_EMAIL) {
      return res.status(403).json({ error: "Superadmin cannot be modified or deleted" });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running 🚀" });
});

// ✅ Register (only USER role here)
app.post("/register", async (req, res) => {
  const { email, password, name, phone } = req.body;
  try {
    if (email === SUPERADMIN_EMAIL) {
      return res.status(403).json({ error: "Superadmin account cannot be created here" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, phone, role: "USER" },
    });

    res.json({ message: "User registered", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ✅ Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ message: "Login successful", token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ Get current user
app.get("/me", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ✅ Superadmin: Create admin
app.post("/create-admin", auth, requireSuperadmin, async (req, res) => {
  const { email, password, name, phone } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: { email, password: hashedPassword, name, phone, role: "ADMIN" },
    });

    res.json({ message: "Admin created successfully", admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

// ✅ CRUD Users (superadmin/admin only)
app.get("/users", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN" && req.user.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Admins only" });
    }
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.delete("/users/:id", auth, requireSuperadmin, protectSuperadmin, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ✅ Rides (basic protected resource)
app.post("/rides", auth, async (req, res) => {
  const { vehicleId, origin, destination } = req.body;
  if (!origin || !destination) return res.status(400).json({ error: "origin and destination required" });

  try {
    const ride = await prisma.ride.create({
      data: { userId: req.user.userId, vehicleId, origin, destination, status: "pending" },
    });
    res.status(201).json(ride);
  } catch (err) {
    res.status(500).json({ error: "Ride creation failed" });
  }
});

app.get("/rides", auth, async (req, res) => {
  try {
    const rides = await prisma.ride.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// ✅ Error handling
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

