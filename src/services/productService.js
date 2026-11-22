import { http } from "./api.js";
import { products as fallbackProducts, categories as fallbackCategories } from "@/data/products.js";
import { fetchProductsFromFirestore, fetchProductByIdFromFirestore } from "@/firebase/firestore.js";
import { resolveProductImage } from "@/lib/images.js";

/**
 * Normalizes any product from backend, Firestore, or local fallback to ensure consistent fields.
 */
export function normalizeProduct(p) {
  if (!p) return null;
  const image = resolveProductImage(p);
  const images = (
    Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : Array.isArray(p.gallery) && p.gallery.length > 0
        ? p.gallery
        : [image]
  ).map((img) => img || image);

  const price = Number(p.price ?? p.sellingPrice ?? 0);
  const mrp = Number(p.mrp ?? p.discountPrice ?? price);
  const stock = Number(p.stock ?? p.storeStock ?? 0);

  return {
    ...p,
    id: String(p.id),
    sku: p.sku || (p.id ? String(p.id).toUpperCase() : ""),
    name: p.name || "NEXUS Component",
    category: p.category || "dev-boards",
    brand: p.brand || "NEXUS",
    price,
    mrp: mrp < price ? price : mrp,
    stock,
    storeStock: stock,
    image,
    images,
    rating: Number(p.rating ?? 4.8),
    reviews: Number(p.reviews ?? 120),
    featured: Boolean(p.featured),
    description: p.description || "",
    specs: p.specs || {},
    datasheetUrl: p.datasheetUrl || null,
  };
}

/**
 * Fetch products list with optional filters and fallback
 */
export async function getProducts(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.category) queryParams.set("category", params.category);
  if (params.brand) queryParams.set("brand", params.brand);
  if (params.q) queryParams.set("q", params.q);
  if (params.sort) queryParams.set("sort", params.sort);
  if (params.maxPrice) queryParams.set("maxPrice", params.maxPrice);
  if (params.inStock) queryParams.set("inStock", "true");

  const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : "";

  try {
    const data = await http(`/products${queryStr}`);
    if (data && Array.isArray(data.products)) {
      return data.products.map(normalizeProduct);
    }
    if (Array.isArray(data)) return data.map(normalizeProduct);
  } catch (err) {
    console.warn("Backend API unavailable, fetching from Firestore/local fallback:", err.message);
  }

  // Graceful fallback to Firestore
  try {
    const firestoreProducts = await fetchProductsFromFirestore();
    return firestoreProducts.map(normalizeProduct);
  } catch {
    return fallbackProducts.map(normalizeProduct);
  }
}

/**
 * Fetch single product details with fallback
 */
export async function getProduct(id) {
  try {
    const data = await http(`/products/${encodeURIComponent(id)}`);
    if (data && data.id) return normalizeProduct(data);
  } catch (err) {
    console.warn(`Backend API unavailable for product ${id}, falling back:`, err.message);
  }

  // Graceful fallback to Firestore/local
  const product = await fetchProductByIdFromFirestore(id);
  return normalizeProduct(product);
}

/**
 * Live search covering store products and supplier catalog via backend
 */
export async function searchProducts(q) {
  if (!q || !q.trim()) return { storeProducts: [], supplierProducts: [] };
  try {
    const res = await http(`/products/search?q=${encodeURIComponent(q.trim())}`);
    return {
      storeProducts: (res.storeProducts || []).map(normalizeProduct),
      supplierProducts: res.supplierProducts || [],
    };
  } catch (err) {
    console.warn("Backend search unavailable, filtering locally:", err.message);
    const queryLower = q.toLowerCase();
    const matched = fallbackProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(queryLower) ||
          p.id.toLowerCase().includes(queryLower) ||
          (p.brand && p.brand.toLowerCase().includes(queryLower)) ||
          (p.description && p.description.toLowerCase().includes(queryLower)),
      )
      .map(normalizeProduct);
    return { storeProducts: matched, supplierProducts: [] };
  }
}

/**
 * Get product specifications from backend / Source Parts
 */
export async function getProductSpecifications(sku) {
  try {
    return await http(`/products/${encodeURIComponent(sku)}/specifications`);
  } catch {
    return null;
  }
}

/**
 * Get product inventory information (supplier vs store stock)
 */
export async function getProductInventory(sku) {
  try {
    return await http(`/products/${encodeURIComponent(sku)}/inventory`);
  } catch {
    return null;
  }
}

/**
 * Get product pricing information (supplier wholesale vs selling price)
 */
export async function getProductPricing(sku) {
  try {
    return await http(`/products/${encodeURIComponent(sku)}/pricing`);
  } catch {
    return null;
  }
}

/**
 * Get product datasheet URL
 */
export async function getProductDatasheet(sku) {
  try {
    return await http(`/products/${encodeURIComponent(sku)}/datasheet`);
  } catch {
    return null;
  }
}

/**
 * Get categories list
 */
export async function getCategories() {
  try {
    const data = await http("/categories");
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {}
  return fallbackCategories;
}
