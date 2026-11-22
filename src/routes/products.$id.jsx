import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ShieldCheck,
  Truck,
  AlertTriangle,
  ChevronLeft,
  FileText,
  ExternalLink,
  Globe,
  Layers,
} from "lucide-react";
import {
  getProduct,
  getProducts,
  getProductInventory,
  getProductPricing,
} from "@/services/productService.js";
import { useStore } from "@/store/StoreProvider.jsx";
import { formatINR } from "@/lib/pricing.js";
import { ProductCard, Stars, StockBadge, Qty } from "@/components/ProductCard.jsx";
import { Page, Empty } from "@/components/Motion.jsx";
import { resolveProductImage, handleImageError } from "@/lib/images.js";

export const Route = createFileRoute("/products/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Component Details — NEXUS" },
      { name: "description", content: "Electronic component specifications and live inventory." },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const {
    data: p,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct(id),
    retry: 1,
  });
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  // Query live supplier inventory from Source Parts network
  const { data: supplierInvData } = useQuery({
    queryKey: ["supplier-inventory", p?.sku || id],
    queryFn: () => getProductInventory(p?.sku || id),
    enabled: Boolean(p),
    staleTime: 5 * 60 * 1000,
  });

  const { data: supplierPricingData } = useQuery({
    queryKey: ["supplier-pricing", p?.sku || id],
    queryFn: () => getProductPricing(p?.sku || id),
    enabled: Boolean(p),
    staleTime: 5 * 60 * 1000,
  });

  const { addToCart, toggleWishlist, wishlist } = useStore();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("specs");

  if (isLoading) {
    return (
      <Page>
        <div className="mx-auto grid max-w-6xl animate-pulse gap-10 px-6 md:grid-cols-2">
          <div className="aspect-square rounded-3xl bg-muted" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 rounded bg-muted" />
            <div className="h-6 w-1/3 rounded bg-muted" />
            <div className="h-24 rounded bg-muted" />
          </div>
        </div>
      </Page>
    );
  }

  if (isError || !p) {
    return (
      <Page>
        <Empty
          icon={AlertTriangle}
          title="Component not found"
          text="This SKU may have been discontinued or is not in the active catalog."
        >
          <Link to="/products" className="btn-primary">
            Back to catalogue
          </Link>
        </Empty>
      </Page>
    );
  }

  const mainImage = resolveProductImage(p);
  const images = (Array.isArray(p.images) && p.images.length > 0 ? p.images : [mainImage]).filter(
    Boolean,
  );
  const safeImgIndex = Math.min(img, images.length - 1);
  const activeImage = images[safeImgIndex] || mainImage;

  const related = allProducts.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  const saved = wishlist.includes(p.id);
  const stock = p.stock ?? p.storeStock ?? 0;
  const mrp = p.mrp || p.price;
  const savings = mrp > p.price ? mrp - p.price : 0;

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-6">
        <Link
          to="/products"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft size={16} /> Catalogue
        </Link>
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <div className="glass relative aspect-square overflow-hidden rounded-3xl">
              <AnimatePresence mode="wait">
                <motion.img
                  key={safeImgIndex}
                  src={activeImage}
                  alt={p.name}
                  onError={(e) => handleImageError(e, p.category, p.name)}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full object-cover"
                />
              </AnimatePresence>
            </div>
            {images.length > 1 && (
              <div className="mt-4 flex gap-3">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setImg(i)}
                    className={`h-20 w-20 overflow-hidden rounded-xl border-2 transition ${
                      safeImgIndex === i
                        ? "border-primary"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={src}
                      alt=""
                      onError={(e) => handleImageError(e, p.category, p.name)}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="eyebrow">{p.brand || "NEXUS"}</span>
              {p.sku && (
                <span className="font-mono text-xs text-muted-foreground">SKU: {p.sku}</span>
              )}
            </div>
            <h1 className="mt-3 text-4xl font-semibold leading-tight">{p.name}</h1>
            <div className="mt-4 flex items-center gap-4">
              <Stars value={p.rating || 4.8} />
              <span className="text-xs text-muted-foreground">
                {(p.reviews || 0).toLocaleString("en-IN")} reviews
              </span>
              <StockBadge stock={stock} />
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-4xl font-semibold">{formatINR(p.price)}</span>
              {savings > 0 && (
                <span className="text-muted-foreground line-through">{formatINR(mrp)}</span>
              )}
              {savings > 0 && (
                <span className="text-sm font-semibold text-primary">
                  Save {formatINR(savings)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Inclusive of all taxes calculated at checkout
            </p>
            <p className="mt-6 text-muted-foreground">{p.description}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Qty value={qty} onChange={setQty} max={stock} />
              <button
                onClick={() => addToCart(p, qty)}
                disabled={stock === 0}
                className="btn-primary flex-1"
              >
                {stock === 0 ? "Out of stock" : "Add to cart"}
              </button>
              <button
                aria-label="Wishlist"
                onClick={() => toggleWishlist(p)}
                className="grid h-12 w-12 place-items-center rounded-full border border-border hover:border-primary"
              >
                <Heart size={18} className={saved ? "fill-primary text-primary" : ""} />
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
              <div className="glass flex items-center gap-3 rounded-2xl p-4">
                <Truck size={18} className="text-primary" /> Ships in 48 hrs
              </div>
              <div className="glass flex items-center gap-3 rounded-2xl p-4">
                <ShieldCheck size={18} className="text-primary" /> 100% Genuine component
              </div>
            </div>

            {/* Technical Datasheet link if available */}
            {p.datasheetUrl && (
              <div className="mt-6">
                <a
                  href={p.datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass flex items-center justify-between rounded-2xl p-4 text-sm font-medium transition hover:border-primary text-primary"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={18} /> Official Manufacturer Datasheet (PDF)
                  </span>
                  <ExternalLink size={16} />
                </a>
              </div>
            )}

            <div className="mt-8">
              <div className="flex gap-6 border-b border-border">
                {["specs", "supplier", "shipping"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`relative pb-3 text-sm capitalize ${tab === t ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {t === "specs"
                      ? "Specifications"
                      : t === "supplier"
                        ? "Supplier Network"
                        : "Shipping & Warranty"}
                    {tab === t && (
                      <motion.span
                        layoutId="tab"
                        className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                      />
                    )}
                  </button>
                ))}
              </div>
              {tab === "specs" ? (
                <dl className="divide-y divide-border">
                  {p.specs && Object.keys(p.specs).length > 0 ? (
                    Object.entries(p.specs).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-3 text-sm">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="font-mono text-foreground">{String(v)}</dd>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-sm text-muted-foreground">
                      Standard manufacturer specifications apply.
                    </p>
                  )}
                </dl>
              ) : tab === "supplier" ? (
                <div className="py-4 space-y-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="glass rounded-2xl p-4">
                      <span className="eyebrow !text-[10px]">NEXUS Store Inventory</span>
                      <div className="mt-1 font-display text-xl font-bold text-foreground">
                        {stock} units
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Ready for 48h dispatch from Bengaluru
                      </div>
                    </div>
                    <div className="glass rounded-2xl p-4">
                      <span className="eyebrow !text-[10px]">Source Parts Global Hub</span>
                      <div className="mt-1 font-display text-xl font-bold text-primary">
                        {supplierInvData?.supplierInventory?.supplierStock !== undefined &&
                        supplierInvData?.supplierInventory?.supplierStock !== null
                          ? `${Number(supplierInvData.supplierInventory.supplierStock).toLocaleString()} units`
                          : "Active Distributor Network"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Authorized factory & distributor stocks
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-xs text-muted-foreground space-y-1.5">
                    <div className="flex justify-between font-mono">
                      <span>NEXUS Retail Price:</span>
                      <span className="font-bold text-foreground">{formatINR(p.price)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-muted-foreground/80">
                      <span>Wholesale Reference Quote:</span>
                      <span>
                        {supplierPricingData?.supplierPricing?.unitPrice
                          ? `${supplierPricingData.supplierPricing.currency} ${supplierPricingData.supplierPricing.unitPrice.toFixed(2)} / unit`
                          : p.supplierPrice
                            ? `~USD ${(p.supplierPrice / 85).toFixed(2)} / unit`
                            : "Available via Source Parts"}
                      </span>
                    </div>
                    <p className="pt-2 text-[11px] text-muted-foreground border-t border-border/40">
                      Wholesale quotes reflect ex-factory pricing from authorized supply chains and
                      do not include customs clearance, GST, or local Express shipping.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground leading-relaxed">
                  Free shipping on orders above ₹999 across India. Orders placed before 3 PM ship
                  the same day via Express air cargo. All boards and ICs are protected by 7-day
                  replacement warranty on DOA components.
                </p>
              )}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-28">
            <h2 className="text-3xl font-semibold">Related components</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Page>
  );
}
