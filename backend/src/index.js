// backend/src/index.js
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import qs from "qs";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const MAIN_ADMIN_EMAIL = process.env.MAIN_ADMIN_EMAIL || "admin@superapp.com";

app.use(express.json());
app.use(morgan("combined"));
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000"],
    credentials: true,
  })
);
app.set("query parser", (str) => qs.parse(str));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 150),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// helper wrapper for async route handlers
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// auth middleware
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing Authorization header" });
  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid Authorization format" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const roles = { USER: 0, ADMIN: 1, SUPERADMIN: 2 };
  if (roles[req.user.role] < roles[role]) return res.status(403).json({ error: "Forbidden" });
  next();
};

// --- AUTH & USERS ---

app.post(
  "/signup",
  wrap(async (req, res) => {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "name,email,password required" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, phone, password: hashed, role: "USER" },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  })
);

app.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const { password: _, ...safeUser } = user;
    res.json({ message: "Login successful", token, user: safeUser });
  })
);

app.get(
  "/me",
  auth,
  wrap(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } });
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json(u);
  })
);

// Admin routes: only SUPERADMIN can create admins (main admin restriction applied)
app.post(
  "/users/:id/promote",
  auth,
  requireRole("ADMIN"),
  wrap(async (req, res) => {
    const caller = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!caller) return res.status(403).json({ error: "No caller" });
    if (caller.email !== MAIN_ADMIN_EMAIL && caller.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Only the main superadmin can promote to admin" });
    }
    const id = Number(req.params.id);
    const updated = await prisma.user.update({ where: { id }, data: { role: "ADMIN" } });
    const { password, ...safe } = updated;
    res.json({ message: "Promoted to ADMIN", user: safe });
  })
);

// Admin: list users
app.get(
  "/users",
  auth,
  requireRole("ADMIN"),
  wrap(async (req, res) => {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }, orderBy: { createdAt: "desc" } });
    res.json(users);
  })
);

// Admin: delete user (protect main admin)
app.delete(
  "/users/:id",
  auth,
  requireRole("ADMIN"),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return res.status(404).json({ error: "User not found" });
    if (u.email === MAIN_ADMIN_EMAIL) return res.status(403).json({ error: "Cannot delete main admin" });
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  })
);

// --- VEHICLES (admin) ---

app.post(
  "/vehicles",
  auth,
  requireRole("ADMIN"),
  wrap(async (req, res) => {
    const { type, plate, driver } = req.body;
    if (!type || !plate) return res.status(400).json({ error: "type & plate required" });
    const v = await prisma.vehicle.create({ data: { type, plate, driver } });
    res.status(201).json(v);
  })
);

app.get(
  "/vehicles",
  auth,
  wrap(async (req, res) => {
    // admins see all; regular users only active vehicles
    const where = req.user?.role === "ADMIN" ? {} : { active: true };
    const vehicles = await prisma.vehicle.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(vehicles);
  })
);

// --- RIDES ---

// create ride (protected)
app.post(
  "/rides",
  auth,
  wrap(async (req, res) => {
    const { vehicleId, origin, originLat, originLng, destination, destLat, destLng } = req.body;
    if (!origin || !destination) return res.status(400).json({ error: "origin & destination required" });

    if (vehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!v) return res.status(400).json({ error: "Invalid vehicleId" });
    }

    const ride = await prisma.ride.create({
      data: {
        userId: req.user.id,
        vehicleId: vehicleId || null,
        origin,
        originLat: originLat ?? null,
        originLng: originLng ?? null,
        destination,
        destLat: destLat ?? null,
        destLng: destLng ?? null,
        status: "pending",
      },
    });
    res.status(201).json(ride);
  })
);

// list user rides
app.get(
  "/rides",
  auth,
  wrap(async (req, res) => {
    const rides = await prisma.ride.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    res.json(rides);
  })
);

// admin: list all rides (with relations)
app.get(
  "/rides/all",
  auth,
  requireRole("ADMIN"),
  wrap(async (req, res) => {
    const rides = await prisma.ride.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true, email: true } }, vehicle: true, payments: true } });
    res.json(rides);
  })
);

// ride detail
app.get(
  "/rides/:id",
  auth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const ride = await prisma.ride.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true } }, vehicle: true, payments: true } });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    // users can only view their own ride unless admin
    if (req.user.role !== "ADMIN" && ride.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    res.json(ride);
  })
);

// update ride status (admin or owner)
app.patch(
  "/rides/:id/status",
  auth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });

    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (req.user.role !== "ADMIN" && ride.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.ride.update({ where: { id }, data: { status } });
    res.json(updated);
  })
);

// simple location-based search: find vehicles near a lat/lng (within radius km)
app.get(
  "/nearby-vehicles",
  auth,
  wrap(async (req, res) => {
    // expects query params: lat, lng, radiusKm (default 5)
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm ?? 5);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: "lat & lng required" });

    // naive approach: return active vehicles (improvement: store vehicle location, use PostGIS)
    const vehicles = await prisma.vehicle.findMany({ where: { active: true } });
    // we don't have vehicle lat/lng stored — just return active vehicles for now
    res.json({ radiusKm, vehicles });
  })
);

// --- PAYMENTS ---

app.post(
  "/payments",
  auth,
  wrap(async (req, res) => {
    const { rideId, amount, currency = "USD", method = "QR" } = req.body;
    const parsedAmount = Number(amount);
    if (!rideId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: "rideId & positive amount required" });

    const ride = await prisma.ride.findUnique({ where: { id: Number(rideId) } });
    if (!ride) return res.status(400).json({ error: "Invalid rideId" });
    if (ride.userId !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    const payment = await prisma.payment.create({ data: { userId: req.user.id, rideId: Number(rideId), amount: parsedAmount, currency, method, status: "pending" } });

    // If method is QR: return payment info client converts to QR code (e.g. string payload)
    if (method === "QR") {
      // simple payload; in production sign the payload + integrate with an acquirer/provider
      const payload = JSON.stringify({ paymentId: payment.id, amount: parsedAmount, currency, rideId: Number(rideId) });
      return res.status(201).json({ payment, qrPayload: payload });
    }

    // For other methods, mark completed for now (demo)
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "completed" } });
    await prisma.ride.update({ where: { id: Number(rideId) }, data: { status: "completed" } });

    res.status(201).json({ payment: { ...payment, status: "completed" } });
  })
);

// --- HEALTH ---
app.get("/health", (req, res) => res.json({ status: "ok" }));

// global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && (err.stack || err.message || err));
  if (err && err.code === "P2002") {
    return res.status(409).json({ error: "Unique constraint failed", details: err.meta });
  }
  res.status(500).json({ error: "Internal server error" });
});

// graceful shutdown
const shutdown = async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));

