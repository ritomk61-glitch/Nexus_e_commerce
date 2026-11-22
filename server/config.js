import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  sourcePartsApiKey: process.env.SOURCE_PARTS_API_KEY || "",
  sourcePartsBaseUrl: process.env.SOURCE_PARTS_BASE_URL || "https://api.source.parts/v1",
  adminInitSecret: process.env.ADMIN_INIT_SECRET || "nexus-super-admin-setup-key-2026",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "nexus-1607a",
  userAgent: "NEXUS-Electronics-Store/1.0 (+https://nexus.store; contact@nexus.store)",
  nodeEnv: process.env.NODE_ENV || "development",
  // Email config
  emailUser: process.env.EMAIL_USER || "",
  emailPass: process.env.EMAIL_PASS || "",
  emailHost: process.env.EMAIL_HOST || "smtp.gmail.com",
  emailPort: parseInt(process.env.EMAIL_PORT || "587", 10),
  emailFrom: process.env.EMAIL_FROM || "",
  siteUrl: process.env.SITE_URL || "http://localhost:3000",
  // UPI / Payments
  merchantUpiId: process.env.MERCHANT_UPI_ID || "",
  merchantName: process.env.MERCHANT_NAME || "NEXUS Electronics",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
};
