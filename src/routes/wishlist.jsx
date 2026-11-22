import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { useStore } from "@/store/StoreProvider.jsx";
import { getProducts } from "@/services/productService.js";
import { ProductCard } from "@/components/ProductCard.jsx";
import { Page, Empty } from "@/components/Motion.jsx";
import { formatINR } from "@/lib/pricing.js";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — NEXUS" },
      { name: "description", content: "Your saved electronic components and hardware builds." },
      { property: "og:title", content: "Wishlist — NEXUS" },
      {
        property: "og:description",
        content: "Your saved electronic components and hardware builds.",
      },
    ],
  }),
  component: Wishlist,
});

function Wishlist() {
  const { wishlist, ready, toggleWishlist, moveToCart } = useStore();
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const items = allProducts.filter((p) => wishlist.includes(p.id));

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Saved Components</span>
            <h1 className="mt-2 text-4xl font-semibold md:text-5xl">Wishlist</h1>
          </div>
          {items.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "component" : "components"} saved
            </div>
          )}
        </div>

        <div className="mt-10">
          {ready && items.length === 0 ? (
            <Empty
              icon={Heart}
              title="Nothing saved yet"
              text="Tap the heart icon on any component in the catalogue to save it to your build wishlist."
            >
              <Link to="/products" className="btn-primary">
                Discover Components
              </Link>
            </Empty>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((p) => (
                <div key={p.id} className="relative flex flex-col">
                  <ProductCard product={p} />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => moveToCart(p)}
                      disabled={p.stock === 0}
                      className="btn-primary !py-2 !text-xs flex-1"
                    >
                      <ShoppingBag size={14} /> Move to Cart
                    </button>
                    <button
                      aria-label="Remove"
                      onClick={() => toggleWishlist(p)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
