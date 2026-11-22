import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import adminRouter from "./routes/admin.js";
import paymentsRouter from "./routes/payments.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { categories as localCategories } from "./data/catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, "../public");

const app = express();

// Security and Parsing Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

// Serve static assets from public/ directory (including /assets/*)
app.use(express.static(publicPath));
app.use("/assets", express.static(path.join(publicPath, "assets")));

// Global Rate Limiting: 200 requests per minute per IP
app.use(rateLimiter({ windowMs: 60 * 1000, maxRequests: 200 }));

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "NEXUS E-Commerce Backend",
    timestamp: new Date().toISOString(),
    externalApiConfigured: Boolean(config.sourcePartsApiKey),
    firebaseProject: config.firebaseProjectId,
  });
});

// Category route
app.get("/api/categories", (req, res) => {
  res.json(localCategories);
});

// API Routes
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentsRouter);

// 404 Handler for undefined API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res
      .status(404)
      .json({ error: `Endpoint ${req.originalUrl} not found on NEXUS API server` });
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[NEXUS Server Error]", err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "An unexpected server error occurred",
    status,
  });
});

// Start listening if run directly
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 NEXUS Backend API Server Running on port ${PORT}`);
  console.log(`  🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`  📦 Products API: http://localhost:${PORT}/api/products`);
  console.log(
    `  🔌 Source Parts API: ${config.sourcePartsApiKey ? "Configured" : "Awaiting API Key (graceful fallback active)"}`,
  );
  console.log(`======================================================\n`);
});

export default app;
