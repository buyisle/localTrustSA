const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("node:path");
const fs = require("node:fs");
const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const { protect } = require("./Middleware/authMiddleware");

// Fix: Use CommonJS require for DNS
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5174",
  }),
);

app.use('/api/marketplace/portfolio', express.json({ limit: '2mb' }), require('./routes/portfolioRoutes'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff') }));
app.post('/api/bookings', protect, (req, res, next) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Only customers can book services' });
  next();
}, express.json({ limit: '5mb' }));
app.use(express.json({ limit: "32kb" }));
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/bookings", require("./routes/demoPaymentRoutes"));
app.use("/api/marketplace", require("./routes/marketplaceRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

// Test API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Local Trust SA API is running!",
  });
});

app.use("/api", (req, res) => res.status(404).json({ message: "API route not found" }));
const clientBuild = path.join(__dirname, "../client/dist");
if (fs.existsSync(path.join(clientBuild, "index.html"))) {
  app.use(express.static(clientBuild));
  app.get("/{*path}", (req, res) => res.sendFile(path.join(clientBuild, "index.html")));
}
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body" });
  if (error.type === "entity.too.large") return res.status(413).json({ message: "Request body is too large" });
  console.error(error.message);
  res.status(500).json({ message: "An unexpected server error occurred" });
});

// MongoDB connection
const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }
    if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters in production");
    }

    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

    await require("./models/Booking").init();
    await require("./models/Conversation").Conversation.init();
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server error:", error.message);
    process.exit(1);
  }
};

if (require.main === module) startServer();
module.exports = app;

