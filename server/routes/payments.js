import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import Razorpay from "razorpay";

const router = Router();

// ==========================================
// RAZORPAY INITIALIZATION
// ==========================================

let razorpay = null;

function getRazorpay() {
  if (razorpay) return razorpay;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) return null;

  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpay;
}

// ==========================================
// 1. UPI QR PAYMENT
// ==========================================

router.post("/upi-qr", (req, res) => {
  try {
    const { amount, orderId } = req.body;

    const payableAmount = Number(amount);

    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment amount",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Order ID is required",
      });
    }

    return res.status(200).json({
      success: true,
      configured: true,
      paymentMethod: "UPI",

      qrImageUrl: "/nexus-upi-qr.jpeg",

      merchantName: "Bhaskar Jha",
      upiId: "7827336335@ptyes",

      amount: payableAmount.toFixed(2),
      orderId: String(orderId),

      message:
      "Scan the QR code using Google Pay, PhonePe, Paytm or BHIM.",
    });

  } catch (error) {
    console.error("[NEXUS] UPI QR Error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load UPI payment",
    });
  }
});

// ==========================================
// 2. RAZORPAY CREATE ORDER
// ==========================================

router.post("/create-order", async (req, res) => {
  try {
    const rp = getRazorpay();

    if (!rp) {
      return res.status(503).json({
        success: false,
        configured: false,
        error: "Razorpay credentials are missing",
      });
    }

    const { amount, orderId } = req.body;

    const payableAmount = Number(amount);

    if (!orderId || !Number.isFinite(payableAmount) || payableAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid order details",
      });
    }

    const amountPaise = Math.round(payableAmount * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment amount",
      });
    }

    // IMPORTANT:
    // For production, fetch the authenticated customer's order
    // from your database and calculate its amount on the server.
    // Do not trust the amount received from the frontend.

    const rpOrder = await rp.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: String(orderId).slice(0, 40),
      notes: {
        nexusOrderId: String(orderId),
        platform: "NEXUS Electronics",
      },
    });

    return res.status(200).json({
      success: true,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("[NEXUS] Razorpay Create Order Error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to create Razorpay order",
    });
  }
});

// ==========================================
// 3. RAZORPAY PAYMENT VERIFICATION
// ==========================================

router.post("/verify", async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing payment information",
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return res.status(503).json({
        success: false,
        error: "Razorpay is not configured",
      });
    }

    if (!/^[a-f0-9]{64}$/i.test(razorpaySignature)) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Invalid signature format",
      });
    }

    const generatedSignature = createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const expected = Buffer.from(generatedSignature, "hex");
    const received = Buffer.from(razorpaySignature, "hex");

    const verified =
      expected.length === received.length &&
      timingSafeEqual(expected, received);

    if (!verified) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Payment signature mismatch",
      });
    }

    const rp = getRazorpay();

    if (!rp) {
      return res.status(503).json({
        success: false,
        error: "Razorpay is not configured",
      });
    }

    // Verify payment directly with Razorpay.

    const payment = await rp.payments.fetch(razorpayPaymentId);

    if (
      payment.order_id !== razorpayOrderId ||
      payment.status !== "captured" ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Payment is not captured or payment details do not match",
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      message: "Payment successfully verified",
    });

  } catch (error) {
    console.error("[NEXUS] Payment Verification Error:", error);

    return res.status(500).json({
      success: false,
      verified: false,
      error: "Payment verification failed",
    });
  }
});

// ==========================================
// 4. PAYMENT CONFIGURATION
// ==========================================

router.get("/config", (req, res) => {
  return res.status(200).json({
    upi: true,

    card: Boolean(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET
    ),

    razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,

    merchantName: "Bhaskar Jha",
    upiId: "7827336335@ptyes",

    qrImageUrl: "/nexus-upi-qr.jpeg",
  });
});

export default router;
