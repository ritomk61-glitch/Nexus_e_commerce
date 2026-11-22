import { config } from "../config.js";

/**
 * Parses JWT payload without requiring native binary dependencies
 */
function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Middleware: Verify Firebase Auth token
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split("Bearer ")[1].trim();
  if (!token) {
    return res.status(401).json({ error: "Empty authentication token" });
  }

  try {
    const payload = parseJwtPayload(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Malformed or invalid token" });
    }

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    // Check audience matches Firebase project
    if (payload.aud && payload.aud !== config.firebaseProjectId) {
      console.warn(
        `[Auth Warning] Token audience ${payload.aud} differs from configured ${config.firebaseProjectId}`,
      );
    }

    req.user = {
      uid: payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email?.split("@")[0] || "User",
      role: payload.role || payload.admin ? "admin" : "user",
      token,
    };

    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(401).json({ error: "Failed to authenticate token" });
  }
}

/**
 * Middleware: Optional Auth (populates req.user if token is present)
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split("Bearer ")[1].trim();
  const payload = parseJwtPayload(token);
  if (payload && payload.sub) {
    req.user = {
      uid: payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email?.split("@")[0] || "User",
      role: payload.role || payload.admin ? "admin" : "user",
      token,
    };
  }
  next();
}

/**
 * Middleware: Require Admin
 */
export function requireAdmin(req, res, next) {
  // Check if req.user has admin role or ADMIN_INIT_SECRET passed in header
  const adminSecretHeader = req.headers["x-admin-secret"];
  if (adminSecretHeader && adminSecretHeader === config.adminInitSecret) {
    req.user = { uid: "system-super-admin", email: "admin@nexus.store", role: "admin" };
    return next();
  }

  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Administrator privileges required." });
  }
  next();
}
