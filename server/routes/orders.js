import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { getStoreProducts } from "./products.js";
import { sendOrderConfirmationEmail } from "../services/emailService.js";
import { generateInvoicePdf, invoiceNumber } from "../services/invoiceService.js";

const router = Router();

// In-memory orders store for backend server
const orders = [];

// In-memory invoice PDF cache (orderId → Buffer)
const invoiceCache = new Map();

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 99;
const GST_RATE = 0.18;
const COUPONS = {
  NEXUS10: 0.1,
  MAKER20: 0.2,
};

export function getAllOrders() {
  return orders;
}

/**
 * POST /api/orders
 * Validates order server-side, recalculates pricing, ensures correct totals
 */
router.post("/", optionalAuth, async (req, res) => {
  try {
    const { items, shipping, payment = "cod", coupon = "" } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty. Cannot create order." });
    }

    if (!shipping || !shipping.name || !shipping.address || !shipping.city || !shipping.pincode) {
      return res.status(400).json({ error: "Complete shipping details are required." });
    }

    if (!/^\d{6}$/.test(shipping.pincode.toString())) {
      return res.status(400).json({ error: "Invalid PIN code. Must be 6 digits." });
    }

    if (shipping.phone && !/^\d{10}$/.test(shipping.phone.toString())) {
      return res.status(400).json({ error: "Invalid mobile number. Must be 10 digits." });
    }

    const storeProducts = getStoreProducts();
    const verifiedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = storeProducts.find((p) => p.id === item.id);
      if (!product) {
        return res
          .status(400)
          .json({ error: `Product "${item.name || item.id}" no longer exists in store.` });
      }

      const qty = parseInt(item.qty, 10);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for ${product.name}` });
      }

      const availableStock = product.stock ?? product.storeStock ?? 0;
      if (availableStock < qty) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${availableStock}, requested: ${qty}`,
        });
      }

      const verifiedPrice = product.price; // ALWAYS use server catalog price
      subtotal += verifiedPrice * qty;

      verifiedItems.push({
        id: product.id,
        name: product.name,
        price: verifiedPrice,
        qty,
        image: product.image,
      });
    }

    // Apply coupon
    const couponKey = (coupon || "").toUpperCase();
    const discountRate = COUPONS[couponKey] || 0;
    const discount = Math.round(subtotal * discountRate);

    // Calculate shipping & GST
    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const taxableAmount = Math.max(0, subtotal - discount);
    const gst = Math.round(taxableAmount * GST_RATE);
    const total = taxableAmount + shippingFee + gst;

    const orderId = `NX${Date.now().toString().slice(-8)}`;
    const newOrder = {
      id: orderId,
      userId: req.user ? req.user.uid : null,
      userEmail: req.user ? req.user.email : shipping.email || null,
      customerName: shipping.name,
      shipping: {
        name: shipping.name,
        phone: shipping.phone || "",
        address: shipping.address,
        city: shipping.city,
        state: shipping.state || "",
        pincode: shipping.pincode,
      },
      items: verifiedItems,
      subtotal,
      discount,
      shippingFee,
      gst,
      total,
      paymentMethod: payment,
      paymentStatus:
        payment === "cod" ? "Pending (Cash on Delivery)" : "Simulated / Awaiting Gateway",
      status: "Confirmed",
      createdAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);

    // Deduct stock
    for (const item of verifiedItems) {
      const prod = storeProducts.find((p) => p.id === item.id);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock ?? prod.storeStock ?? 0) - item.qty);
        prod.storeStock = prod.stock;
      }
    }

    // Respond immediately — email/invoice run in background
    res.status(201).json(newOrder);

    // ── Generate invoice PDF and send confirmation email (non-blocking) ────────
    setImmediate(async () => {
      try {
        const pdfBuffer = await generateInvoicePdf(newOrder);
        // Store PDF in memory keyed by order id for download endpoint
        invoiceCache.set(newOrder.id, pdfBuffer);
        // Send email with attached invoice
        await sendOrderConfirmationEmail(newOrder, pdfBuffer);
      } catch (emailErr) {
        console.error("[Orders] Post-order email/invoice error:", emailErr.message);
      }
    });
  } catch (err) {
    console.error("Order placement error:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

/**
 * GET /api/orders/my-orders
 * List orders for authenticated user
 */
router.get("/my-orders", requireAuth, (req, res) => {
  const userOrders = orders.filter(
    (o) => o.userId === req.user.uid || o.userEmail === req.user.email,
  );
  res.json(userOrders);
});

/**
 * GET /api/orders/:id
 */
router.get("/:id", optionalAuth, (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  // Security: only creator or admin can view
  if (req.user && req.user.role !== "admin" && order.userId && order.userId !== req.user.uid) {
    return res.status(403).json({ error: "Unauthorized to view this order" });
  }

  res.json(order);
});

/**
 * GET /api/orders/:id/invoice
 * Download PDF invoice for an order
 */
router.get("/:id/invoice", optionalAuth, async (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  // Security: only owner or admin can download
  if (
    req.user &&
    req.user.role !== "admin" &&
    order.userId &&
    order.userId !== req.user.uid
  ) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    // Use cached PDF if available, otherwise generate on-demand
    let pdfBuffer = invoiceCache.get(order.id);
    if (!pdfBuffer) {
      pdfBuffer = await generateInvoicePdf(order);
      invoiceCache.set(order.id, pdfBuffer);
    }

    const filename = `NEXUS-Invoice-${order.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("[Orders] Invoice generation error:", err);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

export default router;
