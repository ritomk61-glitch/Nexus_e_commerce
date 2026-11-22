/**
 * NEXUS Centralized Image & Fallback Utilities
 * Provides resilient image resolution and SVG circuit fallbacks
 * ensuring no broken image icons or missing asset layouts ever occur.
 */

export const CATEGORY_FALLBACK_IMAGES = {
  microcontrollers: "/assets/p-board.jpg",
  "dev-boards": "/assets/p-board.jpg",
  sensors: "/assets/p-sensor.jpg",
  ics: "/assets/p-ic.jpg",
  semiconductors: "/assets/p-semi.jpg",
  passives: "/assets/p-passive.jpg",
  power: "/assets/p-power.jpg",
  accessories: "/assets/p-acc.jpg",
  default: "/assets/p-board.jpg",
};

/**
 * Returns an inline SVG data URI representing a futuristic dark circuit component.
 * Used as the ultimate unbreakable fallback when local or remote image files fail.
 */
export function getCategorySvgFallback(category = "electronic", name = "") {
  const catLabel = (category || "COMPONENT").replace(/-/g, " ").toUpperCase();
  const title = (name || catLabel).slice(0, 24);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">
    <rect width="400" height="400" fill="#0b0f14"/>
    <defs>
      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#161f2e" stroke-width="0.8"/>
      </pattern>
      <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#grid)"/>
    <!-- Outer IC Outline -->
    <rect x="110" y="110" width="180" height="180" rx="16" fill="#111827" stroke="#1e293b" stroke-width="3"/>
    <!-- Chip Die -->
    <rect x="140" y="140" width="120" height="120" rx="10" fill="#0f172a" stroke="url(#cyber-grad)" stroke-width="2"/>
    <!-- Circuit Pin Traces -->
    <path d="M 90 150 L 110 150 M 90 170 L 110 170 M 90 190 L 110 190 M 90 210 L 110 210 M 90 230 L 110 230" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 290 150 L 310 150 M 290 170 L 310 170 M 290 190 L 310 190 M 290 210 L 310 210 M 290 230 L 310 230" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 150 90 L 150 110 M 170 90 L 170 110 M 190 90 L 190 110 M 210 90 L 210 110 M 230 90 L 230 110" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 150 290 L 150 310 M 170 290 L 170 310 M 190 290 L 190 310 M 210 290 L 210 310 M 230 290 L 230 310" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Center Dot / Glowing Node -->
    <circle cx="200" cy="200" r="14" fill="#10b981" opacity="0.9"/>
    <circle cx="200" cy="200" r="24" stroke="#10b981" stroke-width="1.5" opacity="0.3"/>
    <!-- Labels -->
    <text x="200" y="340" text-anchor="middle" fill="#10b981" font-family="ui-monospace, monospace" font-size="12" font-weight="700" letter-spacing="2">NEXUS</text>
    <text x="200" y="362" text-anchor="middle" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11" font-weight="500">${title}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolves the safest, highest quality image source for a product.
 */
export function resolveProductImage(product) {
  if (!product) return CATEGORY_FALLBACK_IMAGES.default;

  const candidate =
    product.image ||
    (Array.isArray(product.images) && product.images[0]) ||
    (Array.isArray(product.gallery) && product.gallery[0]) ||
    product.thumbnail;

  if (candidate && typeof candidate === "string" && candidate.trim() !== "") {
    return candidate;
  }

  const category = product.category || "default";
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default;
}

/**
 * Global onError handler for <img> elements displaying products.
 * Gracefully cascades:
 * 1. Product Image -> 2. Category static JPG asset -> 3. High-tech SVG badge
 */
export function handleImageError(event, category = "default", name = "") {
  const imgEl = event.currentTarget;
  if (!imgEl) return;

  const currentSrc = imgEl.src || "";
  const catFallback = CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default;

  // If current image isn't already the category JPG fallback, switch to it
  if (!currentSrc.includes(catFallback)) {
    imgEl.src = catFallback;
    return;
  }

  // If the category JPG fallback also failed, switch to SVG data URI
  const svgFallback = getCategorySvgFallback(category, name);
  if (currentSrc !== svgFallback) {
    imgEl.src = svgFallback;
  }
}
