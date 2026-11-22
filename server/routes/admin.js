import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { sourcePartsApi } from "../services/sourcePartsApi.js";
import { getStoreProducts, setStoreProducts } from "./products.js";
import { getAllOrders } from "./orders.js";
import { config } from "../config.js";

const router = Router();

/**
 * POST /api/admin/init
 * Securely initialize or verify admin privileges using ADMIN_INIT_SECRET
 */
router.post("/init", (req, res) => {
  const { secretKey, email } = req.body;
  if (!secretKey || secretKey !== config.adminInitSecret) {
    return res.status(403).json({ error: "Invalid admin initialization secret key." });
  }

  res.json({
    success: true,
    message: `Admin access authorized for ${email || "administrator"}. Use this secret in x-admin-secret header or configure custom claims.`,
  });
});

// Protect all following routes with requireAdmin
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 */
router.get("/stats", (req, res) => {
  const products = getStoreProducts();
  const orders = getAllOrders();

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const lowStock = products.filter((p) => (p.stock ?? p.storeStock ?? 0) <= 5);

  res.json({
    totalProducts: products.length,
    totalOrders: orders.length,
    totalRevenue,
    lowStockCount: lowStock.length,
    lowStockProducts: lowStock,
  });
});

/**
 * GET /api/admin/orders
 */
router.get("/orders", (req, res) => {
  res.json(getAllOrders());
});

/**
 * PATCH /api/admin/orders/:id/status
 */
router.patch("/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

  if (!status || !validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
  }

  const order = getAllOrders().find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order.status = status;
  order.updatedAt = new Date().toISOString();
  res.json({ success: true, order });
});

/**
 * POST /api/admin/products
 */
router.post("/products", (req, res) => {
  const { name, category, price, mrp, stock, description, specs, brand, image } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: "Name, category, and price are required." });
  }

  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const products = getStoreProducts();

  if (products.some((p) => p.id === id)) {
    return res.status(400).json({ error: "Product with this name/slug already exists." });
  }

  const newProduct = {
    id,
    sku: id.toUpperCase(),
    name,
    category,
    brand: brand || "Generic",
    price: Number(price),
    mrp: Number(mrp || price),
    stock: Number(stock || 0),
    storeStock: Number(stock || 0),
    description: description || "",
    specs: specs || {},
    image: image || "/assets/p-board.jpg",
    images: [image || "/assets/p-board.jpg"],
    rating: 5.0,
    reviews: 0,
    featured: false,
    createdAt: new Date().toISOString(),
  };

  products.unshift(newProduct);
  setStoreProducts(products);
  res.status(201).json(newProduct);
});

/**
 * PUT /api/admin/products/:id
 */
router.put("/products/:id", (req, res) => {
  const { id } = req.params;
  const products = getStoreProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) return res.status(404).json({ error: "Product not found" });

  const existing = products[index];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id, // preserve id
    price: req.body.price !== undefined ? Number(req.body.price) : existing.price,
    mrp: req.body.mrp !== undefined ? Number(req.body.mrp) : existing.mrp,
    stock: req.body.stock !== undefined ? Number(req.body.stock) : existing.stock,
    storeStock: req.body.stock !== undefined ? Number(req.body.stock) : existing.storeStock,
    updatedAt: new Date().toISOString(),
  };

  products[index] = updated;
  setStoreProducts(products);
  res.json(updated);
});

/**
 * DELETE /api/admin/products/:id
 */
router.delete("/products/:id", (req, res) => {
  const { id } = req.params;
  const products = getStoreProducts();
  const filtered = products.filter((p) => p.id !== id);

  if (filtered.length === products.length) {
    return res.status(404).json({ error: "Product not found" });
  }

  setStoreProducts(filtered);
  res.json({ success: true, message: `Product ${id} deleted.` });
});

/**
 * POST /api/admin/sync-supplier-part
 * Sync product from Source Parts API without automatically overwriting custom store pricing/stock
 */
router.post("/sync-supplier-part", async (req, res) => {
  try {
    const { sku, overwritePrices = false } = req.body;
    if (!sku) return res.status(400).json({ error: "SKU or Part Number is required." });

    // Fetch part details, specs, and inventory from Source Parts API
    const [partData, specsData, inventoryData] = await Promise.allSettled([
      sourcePartsApi.getPart(sku),
      sourcePartsApi.getPartSpecs(sku),
      sourcePartsApi.getPartInventory(sku),
    ]);

    const rawPart = partData.status === "fulfilled" ? partData.value : null;
    const part = rawPart?.data || rawPart;
    const rawSpecs = specsData.status === "fulfilled" ? specsData.value : null;
    const rawInv = inventoryData.status === "fulfilled" ? inventoryData.value : null;
    const inventory = rawInv?.data || rawInv;

    if (!part || part.error || part.notFound) {
      return res.status(404).json({
        error: "Part not found in Source Parts API. Please verify the SKU / MPN.",
      });
    }

    // Build specs dictionary from endpoint or part parameters
    let specsDict = rawSpecs?.data?.specifications || rawSpecs?.specifications || {};
    if (Object.keys(specsDict).length === 0 && part.specifications?.parameters) {
      for (const p of part.specifications.parameters) {
        const k = p.paramNameEn || p.paramName;
        const v = p.paramValueEn || p.paramValue;
        if (k && v) specsDict[k] = v;
      }
    }

    const supplierStock = inventory?.quantity ?? part.stock_quantity ?? 0;
    const supplierUnitPrice = part.price
      ? parseFloat(part.price)
      : inventory?.price
        ? parseFloat(inventory.price)
        : null;
    const supplierCurrency = part.currency || "USD";
    const datasheetUrl =
      part.technical_datasheet_url || part.datasheet_url || part.specifications?.datasheet || null;

    const products = getStoreProducts();
    const existingIndex = products.findIndex(
      (p) =>
        p.id === sku.toLowerCase() ||
        p.sku?.toUpperCase() === sku.toUpperCase() ||
        (part.mpn && p.name.toLowerCase().includes(part.mpn.toLowerCase())),
    );

    if (existingIndex !== -1) {
      const existing = products[existingIndex];
      // Sync supplier metadata ONLY, preserve local selling price and store stock unless explicitly requested
      const updated = {
        ...existing,
        supplier: "Source Parts",
        supplierStock,
        supplierPrice: supplierUnitPrice ?? existing.supplierPrice,
        supplierCurrency,
        datasheetUrl: datasheetUrl || existing.datasheetUrl,
        specs: Object.keys(specsDict).length > 0 ? specsDict : existing.specs,
        // Only overwrite store prices if requested
        price:
          overwritePrices && supplierUnitPrice
            ? Math.round(supplierUnitPrice * 95)
            : existing.price,
        updatedAt: new Date().toISOString(),
      };
      products[existingIndex] = updated;
      setStoreProducts(products);
      return res.json({ action: "updated", product: updated });
    } else {
      // Create new imported draft product
      const partKey = (part.mpn || part.sku || sku).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const estimatedSellingINR = supplierUnitPrice ? Math.round(supplierUnitPrice * 95) : 499;
      const estimatedMrpINR = supplierUnitPrice ? Math.round(supplierUnitPrice * 125) : 699;

      const newProduct = {
        id: partKey,
        sku: (part.mpn || part.sku || sku).toUpperCase(),
        name: part.name || part.mpn || sku,
        category: "ics",
        brand: part.manufacturer || "Generic",
        description: part.description || "Component sourced via Source Parts.",
        specs: specsDict,
        datasheetUrl,
        supplier: "Source Parts",
        supplierStock,
        supplierPrice: supplierUnitPrice,
        supplierCurrency,
        price: estimatedSellingINR,
        mrp: estimatedMrpINR,
        stock: Math.min(25, supplierStock || 25), // reasonable initial store stock
        storeStock: Math.min(25, supplierStock || 25),
        image: "/assets/p-ic.jpg",
        images: ["/assets/p-ic.jpg"],
        rating: 4.8,
        reviews: 0,
        featured: false,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      products.unshift(newProduct);
      setStoreProducts(products);
      return res.status(201).json({ action: "created", product: newProduct });
    }
  } catch (err) {
    console.error("Error syncing supplier part:", err);
    res.status(500).json({ error: "Failed to sync part from Source Parts API" });
  }
});

/**
 * GET /api/admin/users
 * List registered users from Firestore via REST API (no firebase-admin needed).
 * Uses Firestore REST API with the Firebase project ID.
 * Note: Returns user Firestore docs (not Auth user records) — includes email, role, createdAt.
 */
router.get("/users", async (req, res) => {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || "nexus-1607a";
    // Use Firestore REST API to list users collection
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?pageSize=200`;

    const response = await fetch(firestoreUrl, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Firestore REST may require auth — return empty with info
      return res.status(503).json({
        error: "Cannot access Firestore REST without service account",
        hint: "Users are stored in Firestore 'users' collection. Configure Firebase Admin SDK for server-side access.",
        users: [],
      });
    }

    const data = await response.json();
    const documents = data.documents || [];

    const users = documents.map((doc) => {
      const fields = doc.fields || {};
      const extractField = (f) => {
        if (!f) return null;
        return f.stringValue ?? f.booleanValue ?? f.integerValue ?? f.timestampValue ?? null;
      };

      return {
        uid: extractField(fields.uid),
        email: extractField(fields.email),
        fullName: extractField(fields.fullName),
        phone: extractField(fields.phone),
        role: extractField(fields.role) || "user",
        createdAt: extractField(fields.createdAt),
        docPath: doc.name,
      };
    });

    res.json({ users, total: users.length });
  } catch (err) {
    console.error("[Admin] Users fetch error:", err);
    res.status(500).json({ error: "Failed to fetch users", details: err.message, users: [] });
  }
});

export default router;
