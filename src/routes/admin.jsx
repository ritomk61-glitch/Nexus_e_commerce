import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Package,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle,
  Clock,
  Layers,
  KeyRound,
  FileText,
  Users,
  Mail,
  MailCheck,
  MailX,
  Download,
  BadgeCheck,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreProvider.jsx";
import { formatINR } from "@/lib/pricing.js";
import { Page, Empty } from "@/components/Motion.jsx";
import { getProducts } from "@/services/productService.js";
import { getAllOrders, updateOrderStatus } from "@/services/orderService.js";
import { http } from "@/services/api.js";
import {
  saveProductToFirestore,
  deleteProductFromFirestore,
  fetchAdminStats,
} from "@/firebase/firestore.js";
import { resolveProductImage, handleImageError } from "@/lib/images.js";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — NEXUS" },
      { name: "description", content: "NEXUS Store Administration & Supplier Operations" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, isAdmin, updateUser } = useStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [elevating, setElevating] = useState(false);

  // Queries
  const { data: products = [], refetch: refetchProducts } = useQuery({
    queryKey: ["admin-products"],
    queryFn: getProducts,
  });

  const { data: orders = [], refetch: refetchOrders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: getAllOrders,
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
  });

  // Local state for product operations
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProd, setNewProd] = useState({
    name: "",
    category: "microcontrollers",
    brand: "",
    price: "",
    mrp: "",
    stock: 50,
    description: "",
    sku: "",
  });

  // Supplier Sync state
  const [syncSku, setSyncSku] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Users query (Firestore REST via admin endpoint)
  const { data: usersData, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => http("/admin/users"),
    enabled: isAdmin,
    retry: false,
  });
  const registeredUsers = usersData?.users || [];
  const [userSearch, setUserSearch] = useState("");

  // Secure admin unlock / promotion
  const handleUnlockAdmin = async (e) => {
    e.preventDefault();
    if (!adminKeyInput.trim()) {
      return toast.error("Please enter the admin initialization secret key.");
    }
    setElevating(true);
    try {
      const res = await http("/admin/init", {
        method: "POST",
        body: {
          secretKey: adminKeyInput.trim(),
          email: user?.email || "admin@nexus.store",
        },
      });
      if (res && res.success) {
        await updateUser({ role: "admin" });
        toast.success("Administrator privileges unlocked successfully!");
      }
    } catch (err) {
      toast.error(err.message || "Invalid administrative secret key.");
    } finally {
      setElevating(false);
    }
  };

  // Add Product
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProd.name || !newProd.price) {
      return toast.error("Please provide product name and selling price.");
    }

    try {
      const id = newProd.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const productPayload = {
        ...newProd,
        id,
        sku: (newProd.sku || id).toUpperCase(),
        price: Number(newProd.price),
        mrp: Number(newProd.mrp || newProd.price),
        stock: Number(newProd.stock || 0),
        image: "/assets/p-board.jpg",
        images: ["/assets/p-board.jpg"],
        rating: 5.0,
        reviews: 0,
        featured: false,
      };

      // Save to Firestore and local backend
      await saveProductToFirestore(productPayload);
      try {
        await http("/admin/products", { method: "POST", body: productPayload });
      } catch {}

      toast.success(`Product "${newProd.name}" published!`);
      setShowAddModal(false);
      setNewProd({
        name: "",
        category: "microcontrollers",
        brand: "",
        price: "",
        mrp: "",
        stock: 50,
        description: "",
        sku: "",
      });
      refetchProducts();
      refetchStats();
    } catch (err) {
      toast.error("Failed to add product: " + err.message);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id, name) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteProductFromFirestore(id);
      try {
        await http(`/admin/products/${id}`, { method: "DELETE" });
      } catch {}
      toast.success(`Product "${name}" deleted.`);
      refetchProducts();
      refetchStats();
    } catch (err) {
      toast.error("Failed to delete product: " + err.message);
    }
  };

  // Order Status update
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success(`Order #${orderId} marked as ${newStatus}`);
      refetchOrders();
      refetchStats();
    } catch (err) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  // Source Parts Sync
  const handleSupplierSync = async (e) => {
    e.preventDefault();
    if (!syncSku.trim()) return toast.error("Enter SKU or Part Number.");
    setSyncLoading(true);
    setSyncResult(null);

    try {
      const res = await http("/admin/sync-supplier-part", {
        method: "POST",
        body: { sku: syncSku.trim() },
      });
      setSyncResult(res);
      toast.success(
        `Successfully synchronized SKU ${syncSku.toUpperCase()} from Source Parts API!`,
      );
      refetchProducts();
    } catch (err) {
      toast.error(err.message || "Could not sync from Source Parts API.");
    } finally {
      setSyncLoading(false);
    }
  };

  // Invoice download
  const downloadInvoice = (orderId) => {
    window.open(`/api/orders/${orderId}/invoice`, "_blank");
  };

  // Unauthenticated / Non-admin Gate
  if (!isAdmin) {
    return (
      <Page>
        <div className="mx-auto max-w-md px-6">
          <div className="glass rounded-3xl p-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert size={28} />
            </div>
            <h1 className="text-2xl font-bold">Admin Portal Restricted</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This area is restricted to NEXUS store administrators and verified engineers.
            </p>

            <form onSubmit={handleUnlockAdmin} className="mt-6 space-y-3 text-left">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Admin Initialization Secret Key
                </label>
                <input
                  type="password"
                  required
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="Enter secret key from .env"
                  className="field"
                />
              </div>
              <button disabled={elevating} className="btn-primary w-full">
                {elevating ? "Verifying..." : "Unlock Administrator Console"}
              </button>
            </form>

            <div className="mt-6 border-t border-border pt-4">
              <Link to="/profile" className="text-xs text-muted-foreground hover:text-primary">
                ← Return to standard profile
              </Link>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const lowStockCount = products.filter((p) => (p.stock ?? p.storeStock ?? 0) <= 5).length;

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="eyebrow">Control Center</span>
            <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Store Administration</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                refetchProducts();
                refetchOrders();
                refetchStats();
                toast.info("Data refreshed");
              }}
              className="btn-ghost !py-2 !text-xs"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-primary !py-2 !text-xs">
              <Plus size={14} /> New Product
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Products</span>
              <Package size={18} className="text-primary" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold">{products.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Across 8 categories</div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Recorded Orders</span>
              <ShoppingBag size={18} className="text-blue-400" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold">{orders.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Logged in Firestore</div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Gross Revenue</span>
              <TrendingUp size={18} className="text-emerald-400" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold">{formatINR(totalRevenue)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">From customer checkouts</div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Low Stock Watch</span>
              <AlertTriangle size={18} className="text-warning" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold">{lowStockCount}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Items with &le; 5 units</div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Registered Users</span>
              <Users size={18} className="text-indigo-400" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold">{registeredUsers.length || "—"}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Accounts in Firestore</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-10 flex flex-wrap gap-1 border-b border-border">
          {[
            ["overview", "Products & Inventory", Package],
            ["orders", "Customer Orders", ShoppingBag],
            ["users", "Registered Users", Users],
            ["supplier", "Source Parts Sync", RefreshCw],
            ["coupons", "Promotions & Rules", Layers],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-medium transition ${
                activeTab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Tab 1: Products */}
        {activeTab === "overview" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-64 flex-1 items-center gap-2 rounded-full border border-border bg-secondary/30 px-4">
                <Search size={15} className="text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter products by name, SKU or category..."
                  className="w-full bg-transparent py-2.5 text-xs outline-none"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {filteredProducts.length} of {products.length} products
              </div>
            </div>

            <div className="glass overflow-x-auto rounded-3xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface/50 font-mono uppercase text-muted-foreground">
                  <tr>
                    <th className="p-4">Component</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Brand</th>
                    <th className="p-4">Selling Price</th>
                    <th className="p-4">Store Stock</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/20">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveProductImage(p)}
                            alt={p.name}
                            onError={(e) => handleImageError(e, p.category, p.name)}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                          <div>
                            <div className="font-semibold text-foreground">{p.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {p.sku || p.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 capitalize text-muted-foreground">{p.category}</td>
                      <td className="p-4 text-muted-foreground">{p.brand || "—"}</td>
                      <td className="p-4 font-mono font-semibold text-foreground">
                        {formatINR(p.price)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-mono font-bold ${
                            (p.stock ?? 0) <= 5 ? "text-warning" : "text-primary"
                          }`}
                        >
                          {p.stock ?? p.storeStock ?? 0}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to="/products/$id"
                            params={{ id: p.id }}
                            target="_blank"
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink size={14} />
                          </Link>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                            title="Delete product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Orders */}
        {activeTab === "orders" && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Orders Pipeline</h2>
              <span className="text-xs text-muted-foreground">{orders.length} total orders</span>
            </div>
            {orders.length === 0 ? (
              <Empty
                icon={ShoppingBag}
                title="No customer orders yet"
                text="Orders will appear here as customers complete checkout."
              />
            ) : (
              <div className="glass overflow-x-auto rounded-3xl">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface/50 font-mono uppercase text-muted-foreground">
                    <tr>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Items</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Payment</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((o) => {
                      const payMethod = (o.paymentMethod || "cod").toUpperCase();
                      const isPaid =
                        o.paymentStatus &&
                        !o.paymentStatus.toLowerCase().includes("pending") &&
                        !o.paymentStatus.toLowerCase().includes("simulated");
                      return (
                        <tr key={o.id} className="hover:bg-secondary/20">
                          <td className="p-4">
                            <div className="font-mono font-bold text-foreground">#{o.id}</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "short" })
                                : "—"}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-foreground">
                              {o.customerName || o.shipping?.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {o.userEmail || o.shipping?.email || "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {o.shipping?.city}
                              {o.shipping?.phone ? ` · ${o.shipping.phone}` : ""}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {o.items?.length || 0} pcs · {o.items?.[0]?.name}
                            {o.items?.length > 1 && ` +${o.items.length - 1} more`}
                          </td>
                          <td className="p-4 font-mono font-bold text-foreground">
                            {formatINR(o.total)}
                          </td>
                          <td className="p-4">
                            <div className="font-mono font-semibold text-foreground">{payMethod}</div>
                            <div
                              className={`mt-0.5 text-[10px] font-medium ${
                                isPaid ? "text-emerald-400" : "text-amber-400"
                              }`}
                            >
                              {isPaid ? "✓ Paid" : "⏳ Pending"}
                            </div>
                          </td>
                          <td className="p-4">
                            <select
                              value={o.status || "Confirmed"}
                              onChange={(e) => handleStatusChange(o.id, e.target.value)}
                              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs outline-none"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Confirmed">Confirmed</option>
                              <option value="Processing">Processing</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => downloadInvoice(o.id)}
                              title="Download PDF Invoice"
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary hover:text-primary"
                            >
                              <Download size={12} /> PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Users */}
        {activeTab === "users" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Registered Users</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Customer accounts stored in Firestore.
                </p>
              </div>
              <button
                onClick={() => refetchUsers()}
                className="btn-ghost !py-2 !text-xs flex items-center gap-2"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-4">
              <Search size={15} className="text-muted-foreground" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full bg-transparent py-2.5 text-xs outline-none"
              />
            </div>

            {usersData?.error && !usersData?.users?.length ? (
              <div className="glass rounded-2xl p-6 text-center">
                <Users size={32} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Firestore access required</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  {usersData.hint || "Configure Firebase Admin SDK or Firestore service account for server-side user listing."}
                </p>
                <p className="mt-3 text-xs text-primary">
                  Users are stored in the <code className="bg-primary/10 px-1 rounded">users</code> Firestore collection.
                </p>
              </div>
            ) : registeredUsers.length === 0 ? (
              <Empty
                icon={Users}
                title="No users found"
                text="Registered users will appear here once accounts are created."
              />
            ) : (
              <div className="glass overflow-x-auto rounded-3xl">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface/50 font-mono uppercase text-muted-foreground">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {registeredUsers
                      .filter(
                        (u) =>
                          !userSearch ||
                          u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) ||
                          u.email?.toLowerCase().includes(userSearch.toLowerCase()),
                      )
                      .map((u, idx) => (
                        <tr key={u.uid || idx} className="hover:bg-secondary/20">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                                {(u.fullName || u.email || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">{u.fullName || "—"}</div>
                                <div className="font-mono text-[10px] text-muted-foreground">
                                  {u.uid?.slice(0, 12)}…
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-mono text-foreground">{u.email || "—"}</div>
                          </td>
                          <td className="p-4 text-muted-foreground">{u.phone || "—"}</td>
                          <td className="p-4">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                u.role === "admin"
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border bg-secondary/40 text-muted-foreground"
                              }`}
                            >
                              {u.role || "user"}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString("en-IN", {
                                  dateStyle: "medium",
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  {registeredUsers.length} registered account{registeredUsers.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Supplier Sync */}
        {activeTab === "supplier" && (
          <div className="mt-8 space-y-6">
            <div className="glass rounded-3xl p-6">
              <span className="eyebrow">Official Integration</span>
              <h2 className="mt-2 text-2xl font-semibold">Source Parts API Importer</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Import specifications, datasheets, and supplier stock levels directly from the
                official Source Parts API. NEXUS preserves your custom retail selling price and
                internal inventory.
              </p>

              <form onSubmit={handleSupplierSync} className="mt-6 flex flex-wrap gap-3">
                <input
                  value={syncSku}
                  onChange={(e) => setSyncSku(e.target.value)}
                  placeholder="Enter SKU / MPN (e.g. ESP32-WROOM-32, ATMEGA328P-PU, NE555P)..."
                  className="field flex-1 min-w-[280px]"
                />
                <button disabled={syncLoading} className="btn-primary shrink-0">
                  {syncLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    "Fetch & Sync Part"
                  )}
                </button>
              </form>

              {syncResult && (
                <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <CheckCircle size={18} /> Sync Completed ({syncResult.action})
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-background/80 p-4 font-mono text-xs text-foreground">
                    {JSON.stringify(syncResult.product, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass rounded-2xl p-5">
                <h3 className="font-semibold text-sm">Configured Base URL</h3>
                <code className="mt-2 block font-mono text-xs text-primary">
                  https://api.source.parts/v1
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  Uses authenticated Bearer header and dedicated User-Agent.
                </p>
              </div>
              <div className="glass rounded-2xl p-5">
                <h3 className="font-semibold text-sm">Separation of Concerns</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  Wholesale supplier quotes are maintained separately from NEXUS customer selling
                  prices to protect profit margins and accurate inventory.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Coupons */}
        {activeTab === "coupons" && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-semibold">Active Store Coupons</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold text-primary">NEXUS10</span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-primary">
                    Active
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">10% discount on order subtotal</p>
                <div className="mt-4 text-xs text-muted-foreground">
                  Valid for all registered makers.
                </div>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold text-primary">MAKER20</span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-primary">
                    Active
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">
                  20% discount on bulk prototyping orders
                </p>
                <div className="mt-4 text-xs text-muted-foreground">
                  Special developer promotion.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Product Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="glass relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 shadow-2xl">
              <h3 className="text-xl font-bold">Add New Electronic Component</h3>
              <form onSubmit={handleAddProduct} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Component Name</label>
                  <input
                    required
                    value={newProd.name}
                    onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                    placeholder="e.g. Raspberry Pi Zero 2 W"
                    className="field"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Category</label>
                    <select
                      value={newProd.category}
                      onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                      className="field"
                    >
                      <option value="microcontrollers">Microcontrollers</option>
                      <option value="dev-boards">Development Boards</option>
                      <option value="sensors">Sensors</option>
                      <option value="ics">Integrated Circuits</option>
                      <option value="semiconductors">Semiconductors</option>
                      <option value="passives">Passives</option>
                      <option value="power">Power Supplies</option>
                      <option value="accessories">Accessories</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Brand / Manufacturer
                    </label>
                    <input
                      value={newProd.brand}
                      onChange={(e) => setNewProd({ ...newProd, brand: e.target.value })}
                      placeholder="e.g. Raspberry Pi"
                      className="field"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={newProd.price}
                      onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                      placeholder="1299"
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">MRP (₹)</label>
                    <input
                      type="number"
                      value={newProd.mrp}
                      onChange={(e) => setNewProd({ ...newProd, mrp: e.target.value })}
                      placeholder="1599"
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      value={newProd.stock}
                      onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
                      placeholder="50"
                      className="field"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                  <textarea
                    rows={3}
                    value={newProd.description}
                    onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                    placeholder="Short engineering summary..."
                    className="field"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-ghost !py-2 !text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary !py-2 !text-xs">
                    Publish Component
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
