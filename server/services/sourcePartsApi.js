import { config } from "../config.js";

// In-memory cache to save external API credits and minimize latency
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data, ttl = CACHE_TTL_MS) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
}

/**
 * Low-level HTTP client for Source Parts API
 */
async function sourcePartsFetch(endpoint, options = {}) {
  const apiKey = config.sourcePartsApiKey;

  if (!apiKey) {
    console.warn(
      `[SourceParts API] Warning: SOURCE_PARTS_API_KEY is not configured. External call to ${endpoint} skipped.`,
    );
    return {
      unavailable: true,
      message: "SOURCE_PARTS_API_KEY is not configured in environment.",
      data: null,
    };
  }

  const url = `${config.sourcePartsBaseUrl}${endpoint}`;
  const cacheKey = `${options.method || "GET"}:${url}:${JSON.stringify(options.body || {})}`;

  // Only cache GET requests
  if (!options.method || options.method === "GET") {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": config.userAgent,
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 401 || res.status === 403) {
      console.error(
        `[SourceParts API] Authentication failed (HTTP ${res.status}). Verify your API key.`,
      );
      return { error: "Authentication failed with Source Parts API", status: res.status };
    }

    if (res.status === 404) {
      return { notFound: true, status: 404, message: "Part not found on Source Parts" };
    }

    if (res.status === 429) {
      console.warn(`[SourceParts API] Rate limited (HTTP 429).`);
      return { rateLimited: true, status: 429, message: "Source Parts API rate limit reached" };
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[SourceParts API] Error response (HTTP ${res.status}):`, errorText);
      return { error: `Source Parts API returned error: ${res.status}`, status: res.status };
    }

    const data = await res.json();
    if (!options.method || options.method === "GET") {
      setCached(cacheKey, data);
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.error(`[SourceParts API] Request timeout for ${url}`);
      return { error: "Source Parts API request timed out", timeout: true };
    }
    console.error(`[SourceParts API] Network error for ${url}:`, err.message);
    return { error: "Unable to reach Source Parts API", networkError: true };
  }
}

export const sourcePartsApi = {
  /**
   * 1. Search products
   * GET /parts/search
   */
  async searchParts(query, { limit = 20, page = 1, category, manufacturer } = {}) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (limit) params.set("limit", limit.toString());
    if (page) params.set("page", page.toString());
    if (category) params.set("category", category);
    if (manufacturer) params.set("manufacturer", manufacturer);

    return sourcePartsFetch(`/parts/search?${params.toString()}`);
  },

  /**
   * 2. Get product details
   * GET /parts/{sku}
   */
  async getPart(sku) {
    if (!sku) throw new Error("SKU is required");
    return sourcePartsFetch(`/parts/${encodeURIComponent(sku)}`);
  },

  /**
   * 3. Get product specifications
   * GET /parts/{sku}/specs
   */
  async getPartSpecs(sku) {
    if (!sku) throw new Error("SKU is required");
    return sourcePartsFetch(`/parts/${encodeURIComponent(sku)}/specs`);
  },

  /**
   * 4. Get product inventory
   * GET /parts/{sku}/inventory
   */
  async getPartInventory(sku) {
    if (!sku) throw new Error("SKU is required");
    return sourcePartsFetch(`/parts/${encodeURIComponent(sku)}/inventory`);
  },

  /**
   * 5. Get product pricing
   * GET /parts/{sku}/pricing
   */
  async getPartPricing(sku) {
    if (!sku) throw new Error("SKU is required");
    return sourcePartsFetch(`/parts/${encodeURIComponent(sku)}/pricing`);
  },

  /**
   * 6. Get datasheet
   * GET /parts/{sku}/datasheet
   */
  async getPartDatasheet(sku) {
    if (!sku) throw new Error("SKU is required");
    return sourcePartsFetch(`/parts/${encodeURIComponent(sku)}/datasheet`);
  },

  /**
   * 7. Get product alternatives
   * GET /parts/{sku}/alternatives
   */
  async getPartAlternatives(sku) {
    if (!sku) throw new Error("SKU is required");
    return sourcePartsFetch(`/parts/${encodeURIComponent(sku)}/alternatives`);
  },

  /**
   * 8. Gather product information
   * GET /parts/{sku}/gather
   */
  async gatherPartInfo(sku) {
    if (!sku) throw new Error("SKU is required");
    return sourcePartsFetch(`/parts/${encodeURIComponent(sku)}/gather`);
  },

  /**
   * 9. Get categories
   * GET /parts/categories
   */
  async getCategories() {
    return sourcePartsFetch(`/parts/categories`);
  },

  /**
   * 10. Get manufacturers
   * GET /parts/manufacturers
   */
  async getManufacturers() {
    return sourcePartsFetch(`/parts/manufacturers`);
  },
};
