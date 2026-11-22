import { describe, expect, it } from "vitest";
import { sourcePartsApi } from "../../server/services/sourcePartsApi.js";
import { formatAuthError } from "../firebase/auth.js";
import { products, categories, brands } from "../data/products.js";
import { calcTotals } from "../lib/pricing.js";
import {
  resolveProductImage,
  getCategorySvgFallback,
  CATEGORY_FALLBACK_IMAGES,
} from "../lib/images.js";
import { normalizeProduct } from "../services/productService.js";

describe("NEXUS Product Catalogue Integrity", () => {
  it("contains all 18 core electronic components", () => {
    expect(products.length).toBeGreaterThanOrEqual(18);
    const names = products.map((p) => p.name);
    expect(names).toContain("Arduino Uno R3");
    expect(names).toContain("ESP32 DevKit V1");
    expect(names).toContain("Raspberry Pi Pico W");
    expect(names).toContain("STM32F103C8T6 Blue Pill");
    expect(names).toContain("HC-SR04 Ultrasonic Sensor");
    expect(names).toContain("DHT22 Temperature & Humidity");
    expect(names).toContain("MPU-6050 6-Axis IMU");
    expect(names).toContain("NE555 Timer IC (Pack of 10)");
    expect(names).toContain("LM358 Dual Op-Amp (Pack of 10)");
    expect(names).toContain("ATmega328P-PU Chip");
    expect(names).toContain("IRFZ44N N-Channel MOSFET (5 pcs)");
    expect(names).toContain("1N4007 Rectifier Diodes (50 pcs)");
    expect(names).toContain("Resistor Kit 600 pcs (30 values)");
    expect(names).toContain("Electrolytic Capacitor Kit 120 pcs");
    expect(names).toContain("Mean Well LRS-50-12 SMPS");
    expect(names).toContain("LM2596 Buck Converter Module");
    expect(names).toContain("Breadboard + 65 Jumper Wires");
    expect(names).toContain("60W Temperature-Controlled Soldering Iron");
  });

  it("has valid prices, categories, and specifications for all components", () => {
    for (const p of products) {
      expect(p.id).toBeTruthy();
      expect(p.price).toBeGreaterThan(0);
      expect(p.mrp).toBeGreaterThanOrEqual(p.price);
      expect(p.category).toBeTruthy();
      expect(p.specs).toBeDefined();
      expect(typeof p.specs).toBe("object");
    }
  });

  it("contains all 8 required electronic component categories", () => {
    expect(categories.length).toBe(8);
    const categoryIds = categories.map((c) => c.id);
    expect(categoryIds).toContain("microcontrollers");
    expect(categoryIds).toContain("dev-boards");
    expect(categoryIds).toContain("sensors");
    expect(categoryIds).toContain("ics");
    expect(categoryIds).toContain("semiconductors");
    expect(categoryIds).toContain("passives");
    expect(categoryIds).toContain("power");
    expect(categoryIds).toContain("accessories");
  });
});

describe("Source Parts API Service Integration", () => {
  it("implements all required official Source Parts endpoints with graceful fallback", async () => {
    const [
      searchRes,
      partRes,
      specsRes,
      invRes,
      pricingRes,
      dsRes,
      altRes,
      gatherRes,
      catsRes,
      mfrsRes,
    ] = await Promise.all([
      sourcePartsApi.searchParts("ESP32"),
      sourcePartsApi.getPart("SP-MOD-2026-19919"),
      sourcePartsApi.getPartSpecs("SP-MOD-2026-19919"),
      sourcePartsApi.getPartInventory("SP-MOD-2026-19919"),
      sourcePartsApi.getPartPricing("SP-MOD-2026-19919"),
      sourcePartsApi.getPartDatasheet("SP-MOD-2026-19919"),
      sourcePartsApi.getPartAlternatives("SP-MOD-2026-19919"),
      sourcePartsApi.gatherPartInfo("SP-MOD-2026-19919"),
      sourcePartsApi.getCategories(),
      sourcePartsApi.getManufacturers(),
    ]);

    expect(searchRes).toBeDefined();
    expect(partRes).toBeDefined();
    expect(specsRes).toBeDefined();
    expect(invRes).toBeDefined();
    expect(pricingRes).toBeDefined();
    expect(dsRes).toBeDefined();
    expect(altRes).toBeDefined();
    expect(gatherRes).toBeDefined();
    expect(catsRes).toBeDefined();
    expect(mfrsRes).toBeDefined();
  }, 25000);
});

describe("Firebase Auth Error Formatting", () => {
  it("translates Firebase codes to informative user messages", () => {
    expect(formatAuthError({ code: "auth/email-already-in-use" })).toContain("already exists");
    expect(formatAuthError({ code: "auth/wrong-password" })).toContain("Invalid email or password");
    expect(formatAuthError({ code: "auth/weak-password" })).toContain("at least 6 characters");
    expect(formatAuthError({ code: "auth/too-many-requests" })).toContain("Too many");
  });
});

describe("Checkout & Order Math Integrity", () => {
  it("prevents negative prices and correctly computes order totals", () => {
    const cart = [
      { id: "esp32-devkit-v1", name: "ESP32", price: 549, qty: 2 },
      { id: "hc-sr04", name: "Ultrasonic", price: 119, qty: 1 },
    ];
    const totals = calcTotals(cart, "MAKER20");
    const subtotal = 549 * 2 + 119; // 1098 + 119 = 1217
    const discount = Math.round(subtotal * 0.2); // 243
    const taxable = subtotal - discount; // 974
    const gst = Math.round(taxable * 0.18); // 175
    const shipping = 0; // >= 999 free shipping
    const expectedTotal = taxable + shipping + gst; // 974 + 175 = 1149

    expect(totals.subtotal).toBe(subtotal);
    expect(totals.discount).toBe(discount);
    expect(totals.shipping).toBe(0);
    expect(totals.gst).toBe(gst);
    expect(totals.total).toBe(expectedTotal);
  });
});

describe("Product Image Loading & Resilient Fallbacks", () => {
  it("resolves valid image sources for all 18 products", () => {
    for (const p of products) {
      const img = resolveProductImage(p);
      expect(img).toBeTruthy();
      expect(typeof img).toBe("string");
      expect(img.length).toBeGreaterThan(0);
    }
  });

  it("safely falls back to category default if product image is missing", () => {
    const productWithoutImage = { id: "test-sensor", category: "sensors", name: "Test Sensor" };
    const resolved = resolveProductImage(productWithoutImage);
    expect(resolved).toBe(CATEGORY_FALLBACK_IMAGES.sensors);
  });

  it("generates a valid SVG circuit data URI for emergency fallback", () => {
    const svgUri = getCategorySvgFallback("microcontrollers", "ESP32 Dev");
    expect(svgUri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(svgUri).toContain("NEXUS");
    expect(svgUri).toContain("ESP32");
  });

  it("normalizes product data fields seamlessly", () => {
    const raw = {
      id: "test-mcu",
      name: "Test MCU",
      sellingPrice: 499,
      storeStock: 25,
      category: "microcontrollers",
    };
    const normalized = normalizeProduct(raw);
    expect(normalized.price).toBe(499);
    expect(normalized.mrp).toBe(499);
    expect(normalized.stock).toBe(25);
    expect(normalized.sku).toBe("TEST-MCU");
    expect(normalized.image).toBe(CATEGORY_FALLBACK_IMAGES.microcontrollers);
  });
});
