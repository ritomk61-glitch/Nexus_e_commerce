import { Router } from "express";
import { sourcePartsApi } from "../services/sourcePartsApi.js";
import { products as localProducts, categories as localCategories } from "../data/catalog.js";

const router = Router();

export function mapSourcePartsCategory(rawCategory = "") {
  if (!rawCategory) return "dev-boards";
  const cat = String(rawCategory).toLowerCase();
  if (
    cat.includes("board") ||
    cat.includes("kit") ||
    cat.includes("evaluation") ||
    cat.includes("proto")
  )
    return "dev-boards";
  if (
    cat.includes("mcu") ||
    cat.includes("microcontroller") ||
    cat.includes("rf") ||
    cat.includes("wifi") ||
    cat.includes("bluetooth") ||
    cat.includes("wireless") ||
    cat.includes("transceiver")
  )
    return "microcontrollers";
  if (
    cat.includes("sensor") ||
    cat.includes("ultrasonic") ||
    cat.includes("transducer") ||
    cat.includes("temperature") ||
    cat.includes("imu") ||
    cat.includes("optical") ||
    cat.includes("gas")
  )
    return "sensors";
  if (
    cat.includes("transistor") ||
    cat.includes("mosfet") ||
    cat.includes("diode") ||
    cat.includes("rectifier") ||
    cat.includes("thyristor") ||
    cat.includes("fet")
  )
    return "semiconductors";
  if (
    cat.includes("resistor") ||
    cat.includes("capacitor") ||
    cat.includes("passive") ||
    cat.includes("inductor") ||
    cat.includes("potentiometer")
  )
    return "passives";
  if (
    cat.includes("power") ||
    cat.includes("converter") ||
    cat.includes("regulator") ||
    cat.includes("supply") ||
    cat.includes("driver")
  )
    return "power";
  if (
    cat.includes("cable") ||
    cat.includes("tool") ||
    cat.includes("wire") ||
    cat.includes("connector") ||
    cat.includes("hardware") ||
    cat.includes("socket")
  )
    return "accessories";
  return "ics";
}

const CATEGORY_DEFAULT_IMAGES = {
  microcontrollers: "/assets/p-board.jpg",
  "dev-boards": "/assets/p-board.jpg",
  sensors: "/assets/p-sensor.jpg",
  ics: "/assets/p-ic.jpg",
  semiconductors: "/assets/p-semi.jpg",
  passives: "/assets/p-passive.jpg",
  power: "/assets/p-power.jpg",
  accessories: "/assets/p-acc.jpg",
};

// In-memory product store for local server operation, synced with Firestore
let storeProducts = [...localProducts];

export function getStoreProducts() {
  return storeProducts;
}

export function setStoreProducts(updated) {
  storeProducts = updated;
}

/**
 * GET /api/products
 * Retrieve store catalogue with filtering, search, and sorting
 */
router.get("/", async (req, res) => {
  try {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      inStock,
      sort,
      q,
      limit = 50,
      page = 1,
    } = req.query;

    let result = [...storeProducts];

    // Filter by query
    if (q) {
      const queryLower = q.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(queryLower) ||
          p.id.toLowerCase().includes(queryLower) ||
          (p.brand && p.brand.toLowerCase().includes(queryLower)) ||
          (p.description && p.description.toLowerCase().includes(queryLower)),
      );
    }

    // Filter by category
    if (category) {
      result = result.filter((p) => p.category === category);
    }

    // Filter by brand
    if (brand) {
      result = result.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
    }

    // Filter by price range
    if (minPrice) {
      result = result.filter((p) => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      result = result.filter((p) => p.price <= Number(maxPrice));
    }

    // Filter in-stock
    if (inStock === "true" || inStock === true) {
      result = result.filter((p) => (p.stock ?? p.storeStock ?? 0) > 0);
    }

    // Sort
    if (sort === "low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === "high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === "newest") {
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else {
      // featured default
      result.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    }

    // Pagination
    const pageSize = Number(limit);
    const pageNum = Number(page);
    const total = result.length;
    const startIndex = (pageNum - 1) * pageSize;
    const items = result.slice(startIndex, startIndex + pageSize);

    res.json({
      products: items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error("Error in GET /api/products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/**
 * GET /api/products/search?q=
 */
router.get("/search", async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (!q.trim()) {
      return res.json({ storeProducts: [], supplierProducts: [] });
    }

    const queryLower = q.toLowerCase();
    const matchedStore = storeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.id.toLowerCase().includes(queryLower) ||
        (p.brand && p.brand.toLowerCase().includes(queryLower)) ||
        (p.description && p.description.toLowerCase().includes(queryLower)),
    );

    // Call Source Parts API for supplier search
    let supplierResults = [];
    try {
      const external = await sourcePartsApi.searchParts(q, { limit: 20 });
      const rawParts = external?.data?.parts || external?.parts || external?.results || [];
      if (Array.isArray(rawParts) && rawParts.length > 0) {
        supplierResults = rawParts.map((part) => {
          const category = mapSourcePartsCategory(part.category);
          const supplierPrice = part.price
            ? parseFloat(part.price)
            : part.pricing?.price
              ? parseFloat(part.pricing.price)
              : null;
          const estimatedRetailINR = supplierPrice ? Math.round(supplierPrice * 95) : null;
          const image =
            part.image_url ||
            part.product_image_url ||
            (Array.isArray(part.images) && part.images[0]) ||
            CATEGORY_DEFAULT_IMAGES[category] ||
            "/assets/p-board.jpg";

          return {
            id: part.sku || part.mpn || part.id,
            sku: part.sku || part.id,
            mpn: part.mpn || part.part_number || part.name,
            name: part.name || part.mpn || part.part_number,
            category,
            rawCategory: part.category,
            manufacturer: part.manufacturer || "Authorized Supplier",
            brand: part.manufacturer || "Authorized Supplier",
            description:
              part.description ||
              "Authentic electronics component available via Source Parts global distributor network.",
            supplierStock: part.stock_quantity ?? part.inventory?.total_quantity ?? null,
            supplierPrice,
            supplierCurrency: part.currency || part.pricing?.currency || "USD",
            price: estimatedRetailINR || 499,
            mrp: estimatedRetailINR ? Math.round(estimatedRetailINR * 1.3) : 699,
            datasheetUrl:
              part.technical_datasheet_url ||
              part.datasheet_url ||
              part.specifications?.datasheet ||
              null,
            image,
            images: [image],
            isSupplierOnly: true,
          };
        });
      }
    } catch (apiErr) {
      console.warn("External supplier search skipped or unavailable:", apiErr.message);
    }

    res.json({
      storeProducts: matchedStore,
      supplierProducts: supplierResults,
    });
  } catch (err) {
    console.error("Error in GET /api/products/search:", err);
    res.status(500).json({ error: "Failed to perform product search" });
  }
});

/**
 * GET /api/categories
 */
router.get("/categories", (req, res) => {
  res.json(localCategories);
});

/**
 * GET /api/products/:sku
 * Get product details with fallback and optional supplier enrichment
 */
router.get("/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const product = storeProducts.find(
      (p) =>
        p.id === sku ||
        p.id === sku.toLowerCase() ||
        p.sku?.toUpperCase() === sku.toUpperCase(),
    );

    if (!product) {
      // Check Source Parts API if not in local store
      try {
        const rawPartRes = await sourcePartsApi.getPart(sku);
        const part = rawPartRes?.data || rawPartRes;
        if (part && !part.notFound && !part.error && (part.sku || part.name || part.id)) {
          const category = mapSourcePartsCategory(part.category);
          const supplierPrice = part.price ? parseFloat(part.price) : null;
          const estimatedRetailINR = supplierPrice ? Math.round(supplierPrice * 95) : 499;

          let specsDict = part.specifications?.specifications || {};
          if (Object.keys(specsDict).length === 0 && part.specifications?.parameters) {
            for (const p of part.specifications.parameters) {
              const k = p.paramNameEn || p.paramName;
              const v = p.paramValueEn || p.paramValue;
              if (k && v) specsDict[k] = v;
            }
          }

          const image =
            part.image_url ||
            part.product_image_url ||
            (Array.isArray(part.images) && part.images[0]) ||
            CATEGORY_DEFAULT_IMAGES[category] ||
            "/assets/p-board.jpg";

          const formattedSupplierProduct = {
            id: part.sku || part.mpn || sku,
            sku: part.sku || sku,
            mpn: part.mpn || part.sku || sku,
            name: part.name || part.mpn || sku,
            category,
            rawCategory: part.category,
            brand: part.manufacturer || "Authorized Supplier",
            description:
              part.description ||
              "Authentic component sourced from Source Parts Global Supplier Network.",
            supplier: part.manufacturer || "Source Parts Global",
            supplierStock: part.stock_quantity ?? 0,
            supplierPrice,
            supplierCurrency: part.currency || "USD",
            stock: 0,
            storeStock: 0,
            price: estimatedRetailINR,
            mrp: Math.round(estimatedRetailINR * 1.3),
            rating: 4.8,
            reviews: 0,
            datasheetUrl:
              part.technical_datasheet_url ||
              part.datasheet_url ||
              part.specifications?.datasheet ||
              null,
            image,
            images: [image],
            specs: specsDict,
            isSupplierOnly: true,
            status: "active",
          };

          return res.json(formattedSupplierProduct);
        }
      } catch (err) {
        console.warn("Could not fetch part from Source Parts:", err.message);
      }

      return res.status(404).json({ error: "Product not found" });
    }

    // Enrich with datasheet or supplier data if available
    res.json(product);
  } catch (err) {
    console.error(`Error in GET /api/products/${req.params.sku}:`, err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

/**
 * GET /api/products/:sku/specifications
 */
router.get("/:sku/specifications", async (req, res) => {
  const { sku } = req.params;
  const product = storeProducts.find(
    (p) => p.id === sku || p.sku?.toUpperCase() === sku.toUpperCase(),
  );

  // Try Source Parts API specs endpoint
  try {
    const specsRes = await sourcePartsApi.getPartSpecs(sku);
    const specsData = specsRes?.data?.specifications || specsRes?.specifications;
    if (specsData && typeof specsData === "object" && Object.keys(specsData).length > 0) {
      return res.json({ specs: specsData, source: "source_parts" });
    }
  } catch (err) {}

  // Fallback: extract parameters from Source Parts part detail
  try {
    const partRes = await sourcePartsApi.getPart(sku);
    const part = partRes?.data || partRes;
    if (part?.specifications?.parameters && Array.isArray(part.specifications.parameters)) {
      const parsedSpecs = {};
      for (const param of part.specifications.parameters) {
        const key = param.paramNameEn || param.paramName;
        const val = param.paramValueEn || param.paramValue;
        if (key && val) parsedSpecs[key] = val;
      }
      if (Object.keys(parsedSpecs).length > 0) {
        return res.json({ specs: parsedSpecs, source: "source_parts_live" });
      }
    }
  } catch (err) {}

  if (product && product.specs) {
    return res.json({ specs: product.specs, source: "store" });
  }

  res.status(404).json({ error: "Specifications not found for this part" });
});

/**
 * GET /api/products/:sku/inventory
 * Returns supplier inventory without assuming it is store inventory
 */
router.get("/:sku/inventory", async (req, res) => {
  const { sku } = req.params;
  const product = storeProducts.find(
    (p) => p.id === sku || p.sku?.toUpperCase() === sku.toUpperCase(),
  );

  let supplierInventory = null;
  try {
    const invRes = await sourcePartsApi.getPartInventory(sku);
    const invData = invRes?.data || invRes;
    if (invData && (invData.quantity !== undefined || invData.available !== undefined)) {
      supplierInventory = {
        supplierStock: invData.quantity ?? 0,
        available: invData.available ?? true,
        partNumber: invData.part_number || sku,
        leadTimeDays: invData.lead_time_days ?? null,
      };
    } else {
      // Fallback: check part detail
      const partRes = await sourcePartsApi.getPart(sku);
      const part = partRes?.data || partRes;
      if (part && part.stock_quantity !== undefined) {
        supplierInventory = {
          supplierStock: part.stock_quantity,
          available: part.stock_quantity > 0,
          partNumber: part.sku || sku,
        };
      }
    }
  } catch (err) {}

  res.json({
    sku,
    storeStock: product ? (product.stock ?? product.storeStock ?? 0) : 0,
    supplierInventory: supplierInventory || {
      supplierStock: null,
      available: false,
      note: "Live supplier query subject to API key configuration.",
    },
  });
});

/**
 * GET /api/products/:sku/pricing
 * Returns supplier pricing separated from NEXUS store selling price
 */
router.get("/:sku/pricing", async (req, res) => {
  const { sku } = req.params;
  const product = storeProducts.find(
    (p) => p.id === sku || p.sku?.toUpperCase() === sku.toUpperCase(),
  );

  let supplierPricing = null;
  try {
    const pricingRes = await sourcePartsApi.getPartPricing(sku);
    const pricingData = pricingRes?.data || pricingRes;
    if (pricingData && (pricingData.price_breaks || pricingData.currency)) {
      supplierPricing = {
        currency: pricingData.currency || "USD",
        priceBreaks: pricingData.price_breaks || [],
        unitPrice: pricingData.price_breaks?.[0]?.unit_price ?? null,
      };
    } else {
      const partRes = await sourcePartsApi.getPart(sku);
      const part = partRes?.data || partRes;
      if (part && part.price) {
        supplierPricing = {
          currency: part.currency || "USD",
          unitPrice: parseFloat(part.price),
        };
      }
    }
  } catch (err) {}

  res.json({
    sku,
    sellingPriceINR: product ? product.price : null,
    mrpINR: product ? product.mrp : null,
    supplierPricing: supplierPricing || {
      currency: "USD",
      note: "Live supplier wholesale pricing available via Source Parts API.",
    },
  });
});

/**
 * GET /api/products/:sku/datasheet
 */
router.get("/:sku/datasheet", async (req, res) => {
  const { sku } = req.params;
  const product = storeProducts.find(
    (p) => p.id === sku || p.sku?.toUpperCase() === sku.toUpperCase(),
  );

  try {
    const dsRes = await sourcePartsApi.getPartDatasheet(sku);
    const dsData = dsRes?.data || dsRes;
    const url = dsData?.datasheet_url || dsData?.url;
    if (url) {
      return res.json({ url, sku });
    }

    const partRes = await sourcePartsApi.getPart(sku);
    const part = partRes?.data || partRes;
    const partUrl = part?.technical_datasheet_url || part?.specifications?.datasheet;
    if (partUrl) {
      return res.json({ url: partUrl, sku });
    }
  } catch (err) {}

  if (product && product.datasheetUrl) {
    return res.json({ url: product.datasheetUrl, sku });
  }

  res.status(404).json({ error: "Datasheet not found for this part", sku });
});

/**
 * GET /api/products/:sku/alternatives
 */
router.get("/:sku/alternatives", async (req, res) => {
  const { sku } = req.params;
  try {
    const altRes = await sourcePartsApi.getPartAlternatives(sku);
    const altData = altRes?.data || altRes;
    return res.json({
      sku,
      alternatives: altData?.alternatives || [],
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alternatives" });
  }
});

export default router;
