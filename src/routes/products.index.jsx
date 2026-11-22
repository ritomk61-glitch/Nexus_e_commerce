import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  PackageSearch,
  AlertTriangle,
  Globe,
  FileText,
  ExternalLink,
  PlusCircle,
  Loader2,
} from "lucide-react";
import { getProducts, searchProducts } from "@/services/productService.js";
import { categories } from "@/data/products.js";
import { ProductCard, ProductSkeleton } from "@/components/ProductCard.jsx";
import { Page, Empty } from "@/components/Motion.jsx";
import { useStore } from "@/store/StoreProvider.jsx";
import { http } from "@/services/api.js";
import { toast } from "sonner";

export const Route = createFileRoute("/products/")({
  validateSearch: (s) => ({
    q: typeof s.q === "string" ? s.q : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop Components — NEXUS" },
      {
        name: "description",
        content:
          "Browse microcontrollers, sensors, ICs, passives and power supplies with live filters.",
      },
      { property: "og:title", content: "Shop Components — NEXUS" },
      {
        property: "og:description",
        content: "Search and filter thousands of electronic components.",
      },
    ],
  }),
  component: Products,
});

const MAX = 1500;

function Products() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products/" });
  const { isAdmin } = useStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const [maxPrice, setMaxPrice] = useState(MAX);
  const [sort, setSort] = useState("featured");
  const [view, setView] = useState("grid");
  const [inStock, setInStock] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [syncingSku, setSyncingSku] = useState(null);

  const q = search.q || "";
  const cat = search.category || "";

  // Live Source Parts API search when query is active
  const { data: searchApiResult, isLoading: isSearchLoading } = useQuery({
    queryKey: ["source-parts-search", q],
    queryFn: () => searchProducts(q),
    enabled: Boolean(q && q.trim().length >= 2),
    staleTime: 5 * 60 * 1000,
  });

  const supplierParts = searchApiResult?.supplierProducts || [];

  const set = (patch) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  const list = useMemo(() => {
    let r = (data || []).filter(
      (p) =>
        (!cat || p.category === cat) &&
        p.price <= maxPrice &&
        (!inStock || p.stock > 0) &&
        (!q || `${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(q.toLowerCase())),
    );
    if (sort === "low") r = [...r].sort((a, b) => a.price - b.price);
    if (sort === "high") r = [...r].sort((a, b) => b.price - a.price);
    if (sort === "rating") r = [...r].sort((a, b) => b.rating - a.rating);
    if (sort === "featured") r = [...r].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return r;
  }, [data, cat, maxPrice, inStock, q, sort]);

  const handleImportToStore = async (supplierPart) => {
    const skuToSync = supplierPart.mpn || supplierPart.sku;
    setSyncingSku(skuToSync);
    try {
      await http("/admin/sync-supplier-part", {
        method: "POST",
        body: { sku: skuToSync },
      });
      toast.success(`${skuToSync} synchronized into NEXUS catalogue!`);
      refetch();
    } catch (err) {
      toast.error("Failed to sync: " + err.message);
    } finally {
      setSyncingSku(null);
    }
  };

  const Filters = (
    <div className="space-y-8">
      <div>
        <h4 className="eyebrow mb-3">Category</h4>
        <div className="space-y-1">
          {[{ id: "", name: "All components" }, ...categories].map((c) => (
            <button
              key={c.id}
              onClick={() => set({ category: c.id || undefined })}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                cat === c.id
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="eyebrow mb-3">Max price · ₹{maxPrice}</h4>
        <input
          type="range"
          min={50}
          max={MAX}
          step={50}
          value={maxPrice}
          onChange={(e) => setMaxPrice(+e.target.value)}
          className="w-full accent-primary"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
          className="accent-primary"
        />{" "}
        In stock only
      </label>
    </div>
  );

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-6">
        <span className="eyebrow">Catalogue</span>
        <h1 className="mt-3 text-4xl font-semibold md:text-6xl">
          {categories.find((c) => c.id === cat)?.name || "All components"}
        </h1>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div className="flex min-w-60 flex-1 items-center gap-2 rounded-full border border-border bg-secondary/40 px-4">
            <Search size={16} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Search by name, brand, SKU or spec…"
              className="w-full bg-transparent py-3 text-sm outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="field !w-auto !rounded-full"
          >
            <option value="featured">Featured</option>
            <option value="low">Price: Low to high</option>
            <option value="high">Price: High to low</option>
            <option value="rating">Top rated</option>
          </select>
          <div className="flex rounded-full border border-border p-1">
            {[
              ["grid", LayoutGrid],
              ["list", List],
            ].map(([v, I]) => (
              <button
                key={v}
                aria-label={`${v} view`}
                onClick={() => setView(v)}
                className={`grid h-9 w-9 place-items-center rounded-full ${
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <I size={16} />
              </button>
            ))}
          </div>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="btn-ghost !py-2.5 lg:hidden"
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside
            className={`${
              filtersOpen ? "block" : "hidden"
            } glass rounded-2xl p-5 lg:block lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none`}
          >
            {Filters}
          </aside>
          <div>
            {isError ? (
              <Empty
                icon={AlertTriangle}
                title="Couldn't load products"
                text="Check your connection and try again."
              >
                <button onClick={() => refetch()} className="btn-primary">
                  Retry
                </button>
              </Empty>
            ) : isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : list.length === 0 && supplierParts.length === 0 ? (
              <Empty
                icon={PackageSearch}
                title="No components match"
                text="Try a different search or loosen your filters."
              >
                <button
                  onClick={() => {
                    set({ q: undefined, category: undefined });
                    setMaxPrice(MAX);
                    setInStock(false);
                  }}
                  className="btn-primary"
                >
                  Reset filters
                </button>
              </Empty>
            ) : (
              <>
                {/* Store Products Section */}
                <div className="flex items-center justify-between mb-5">
                  <p className="font-mono text-xs text-muted-foreground">
                    {list.length} {list.length === 1 ? "component in stock" : "components in stock"}
                  </p>
                  {q && isSearchLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <Loader2 size={12} className="animate-spin text-primary" /> Checking Source
                      Parts network...
                    </span>
                  )}
                </div>

                {list.length > 0 ? (
                  <div
                    className={
                      view === "grid" ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" : "space-y-4"
                    }
                  >
                    {list.map((p) => (
                      <ProductCard key={p.id} product={p} layout={view} />
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground mb-8">
                    No immediate store inventory matched &ldquo;{q}&rdquo;. See live global
                    distributor network results below.
                  </div>
                )}

                {/* Source Parts Live Supplier Sourcing Section */}
                {supplierParts.length > 0 && (
                  <div className="mt-16 pt-10 border-t border-border">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="eyebrow">Source Parts Official Network</span>
                          <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-[10px] text-primary">
                            Live Supplier API
                          </span>
                        </div>
                        <h2 className="mt-1 text-2xl font-semibold">
                          Global Distributor Inventory
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Parts available for direct sourcing from authorized manufacturers.
                        </p>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {supplierParts.length} parts found
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {supplierParts.map((sp, idx) => (
                        <div
                          key={sp.sku || idx}
                          className="glass rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition duration-300"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="eyebrow !text-[10px]">{sp.manufacturer}</span>
                                <h3 className="font-display font-semibold text-foreground text-sm mt-0.5">
                                  {sp.mpn || sp.name}
                                </h3>
                              </div>
                              {sp.supplierStock !== null && (
                                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[10px] text-foreground shrink-0">
                                  {sp.supplierStock.toLocaleString()} in hub
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {sp.description}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-muted-foreground block">
                                Supplier Wholesale Quote
                              </span>
                              <span className="font-mono font-semibold text-foreground">
                                {sp.supplierPrice !== null
                                  ? `${sp.supplierCurrency} ${sp.supplierPrice.toFixed(2)}`
                                  : "Quote on Request"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {sp.datasheetUrl && (
                                <a
                                  href={sp.datasheetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-border p-2 text-muted-foreground hover:text-primary hover:border-primary transition"
                                  title="View Datasheet PDF"
                                >
                                  <FileText size={14} />
                                </a>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleImportToStore(sp)}
                                  disabled={syncingSku === (sp.mpn || sp.sku)}
                                  className="btn-primary !px-3 !py-1.5 !text-xs"
                                  title="Import component into NEXUS catalogue"
                                >
                                  {syncingSku === (sp.mpn || sp.sku) ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <PlusCircle size={12} />
                                  )}
                                  Import
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
