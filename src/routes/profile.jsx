import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  Package,
  MapPin,
  KeyRound,
  ShieldCheck,
  Plus,
  ShoppingBag,
  Heart,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Mail,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreProvider.jsx";
import { formatINR } from "@/lib/pricing.js";
import { Page, Empty } from "@/components/Motion.jsx";
import { forgotPassword } from "@/services/authService.js";
import { resolveProductImage, handleImageError } from "@/lib/images.js";
import { resendVerificationEmail } from "@/firebase/auth.js";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Account — NEXUS" },
      { name: "description", content: "Account details, saved addresses, and order history." },
      { property: "og:title", content: "My Account — NEXUS" },
      {
        property: "og:description",
        content: "Account details, saved addresses, and order history.",
      },
    ],
  }),
  component: Profile,
});

const STATUS_COLORS = {
  Pending: "bg-warning/10 text-warning border-warning/20",
  Confirmed: "bg-primary/10 text-primary border-primary/20",
  Processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Shipped: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

function Profile() {
  const { user, orders, logout, updateUser, addAddress, ready, cartCount, wishlist, isAdmin } =
    useStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("orders");
  const [f, setF] = useState({ name: "", phone: "" });
  const [addrForm, setAddrForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (user) {
      setF({ name: user.name || user.fullName || "", phone: user.phone || "" });
      setAddrForm((prev) => ({
        ...prev,
        name: user.name || user.fullName || "",
        phone: user.phone || "",
      }));
    }
  }, [user]);

  if (!user) {
    return (
      <Page>
        <div className="mx-auto h-60 max-w-6xl animate-pulse rounded-3xl bg-muted/40 px-6" />
      </Page>
    );
  }

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateUser({ name: f.name.trim(), fullName: f.name.trim(), phone: f.phone.trim() });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!addrForm.address || !addrForm.city || !addrForm.pincode) {
      return toast.error("Please fill in the complete address.");
    }
    await addAddress(addrForm);
    setShowAddAddr(false);
    setAddrForm({
      name: user.name || "",
      phone: user.phone || "",
      address: "",
      city: "",
      state: "",
      pincode: "",
    });
  };

  const handleResetPassword = async () => {
    if (!user.email) return;
    try {
      await forgotPassword(user.email);
      toast.success(`Password reset email dispatched to ${user.email}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail();
      toast.success("Verification email sent! Check your inbox.");
    } catch (err) {
      toast.error(err.message || "Could not send verification email.");
    }
  };

  const downloadInvoice = (orderId) => {
    window.open(`/api/orders/${orderId}/invoice`, "_blank");
  };

  const addresses = user.addresses || [];

  return (
    <Page>
      {/* Email verification banner */}
      {user && user.emailVerified === false && (
        <div className="mx-auto mb-6 max-w-6xl px-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-amber-400 shrink-0" />
              <span className="text-amber-300">
                <strong>Verify your email</strong> — Check your inbox for a verification link.
              </span>
            </div>
            <button
              onClick={handleResendVerification}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition shrink-0"
            >
              <RefreshCw size={12} /> Resend
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[340px_1fr]">
        {/* Left Sidebar */}
        <aside className="space-y-6">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-start justify-between">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary font-display text-2xl font-bold text-primary-foreground glow">
                {(user.name || user.email)?.[0]?.toUpperCase()}
              </div>
              {isAdmin && (
                <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                  <ShieldCheck size={12} /> Admin
                </span>
              )}
            </div>

            <h1 className="mt-4 text-2xl font-semibold leading-tight">
              {user.name || "NEXUS Engineer"}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
            {user.phone && <p className="mt-1 text-xs text-muted-foreground">{user.phone}</p>}

            {/* Admin Dashboard Quick Access */}
            {isAdmin && (
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground text-sm">Store Management</div>
                    <div className="text-xs text-muted-foreground">Admin panel & supplier sync</div>
                  </div>
                  <Link to="/admin" className="btn-primary !px-3 !py-1.5 !text-xs">
                    Admin <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-6 text-center text-xs">
              <Link
                to="/cart"
                className="rounded-xl border border-border p-3 transition hover:border-primary"
              >
                <div className="font-display text-lg font-bold text-foreground">{cartCount}</div>
                <div className="text-muted-foreground">In Cart</div>
              </Link>
              <Link
                to="/wishlist"
                className="rounded-xl border border-border p-3 transition hover:border-primary"
              >
                <div className="font-display text-lg font-bold text-foreground">
                  {wishlist.length}
                </div>
                <div className="text-muted-foreground">Wishlist</div>
              </Link>
            </div>

            {/* Navigation Tabs */}
            <div className="mt-6 space-y-1">
              {[
                ["orders", "My Orders", Package, orders.length],
                ["profile", "Profile & Security", KeyRound, null],
                ["addresses", "Saved Addresses", MapPin, addresses.length],
              ].map(([key, label, Icon, count]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm transition ${
                    activeTab === key
                      ? "bg-accent text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={16} /> {label}
                  </span>
                  {count !== null && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                logout();
                navigate({ to: "/" });
              }}
              className="btn-ghost mt-6 w-full !text-xs !py-2.5 text-destructive hover:border-destructive hover:text-destructive"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </aside>

        {/* Right Content */}
        <section>
          {/* Tab 1: Orders */}
          {activeTab === "orders" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-semibold">My Orders</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track hardware shipments and order invoices.
                  </p>
                </div>
                <Link to="/products" className="btn-ghost !text-xs !py-2">
                  Browse Store
                </Link>
              </div>

              <div className="mt-8 space-y-5">
                {orders.length === 0 ? (
                  <Empty
                    icon={Package}
                    title="No orders placed yet"
                    text="Your orders will appear here once you make your first build purchase."
                  >
                    <Link to="/products" className="btn-primary">
                      Explore Components
                    </Link>
                  </Empty>
                ) : (
                  orders.map((o) => (
                    <div
                      key={o.id}
                      className="glass rounded-3xl p-6 transition duration-300 hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-foreground">#{o.id}</span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[o.status] || STATUS_COLORS.Pending}`}
                            >
                              {o.status || "Confirmed"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock size={13} />
                            {o.createdAt
                              ? new Date(o.createdAt).toLocaleDateString("en-IN", {
                                  dateStyle: "medium",
                                })
                              : "Recent"}
                            <span>·</span>
                            <span>Payment: {o.paymentMethod?.toUpperCase() || "COD"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-xl font-bold text-foreground">
                            {formatINR(o.total)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {o.items?.length || 0} items
                          </div>
                          <button
                            onClick={() => downloadInvoice(o.id)}
                            title="Download Invoice PDF"
                            className="mt-2 flex items-center gap-1 ml-auto text-[11px] text-primary hover:text-primary/80 transition"
                          >
                            <Download size={12} /> Invoice
                          </button>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mt-4 space-y-3">
                        {o.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-4">
                            <img
                              src={resolveProductImage(item)}
                              alt={item.name}
                              onError={(e) => handleImageError(e, item.category, item.name)}
                              className="h-12 w-12 rounded-xl object-cover"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm text-foreground">{item.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Qty: {item.qty} × {formatINR(item.price)}
                              </div>
                            </div>
                            <div className="font-mono text-sm font-semibold">
                              {formatINR(item.price * item.qty)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Shipping details */}
                      {o.shipping && (
                        <div className="mt-4 rounded-xl border border-border/50 bg-secondary/30 p-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Shipping to: </span>
                          {o.shipping.name}, {o.shipping.address}, {o.shipping.city} -{" "}
                          {o.shipping.pincode} (Tel: {o.shipping.phone})
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Profile & Security */}
          {activeTab === "profile" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-semibold">Profile & Security</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage your personal details and authentication options.
                </p>
              </div>

              <div className="glass rounded-3xl p-6">
                <h3 className="font-semibold text-lg">Personal Information</h3>
                <form onSubmit={handleProfileSave} className="mt-5 space-y-4 max-w-md">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Full Name</label>
                    <input
                      value={f.name}
                      onChange={(e) => setF({ ...f, name: e.target.value })}
                      placeholder="Name"
                      className="field"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Email (Managed by Firebase Auth)
                    </label>
                    <input
                      value={user.email}
                      disabled
                      className="field opacity-60 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Phone Number</label>
                    <input
                      value={f.phone}
                      onChange={(e) => setF({ ...f, phone: e.target.value })}
                      placeholder="9876543210"
                      className="field"
                    />
                  </div>
                  <button disabled={savingProfile} className="btn-primary">
                    {savingProfile ? "Saving..." : "Save changes"}
                  </button>
                </form>
              </div>

              <div className="glass rounded-3xl p-6">
                <h3 className="font-semibold text-lg">Password & Security</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Receive a secure one-click password reset link sent to your verified email
                  address: <span className="font-mono text-foreground">{user.email}</span>.
                </p>
                <div className="mt-4">
                  <button onClick={handleResetPassword} className="btn-ghost !text-xs !py-2.5">
                    <KeyRound size={15} /> Request Password Reset Email
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Addresses */}
          {activeTab === "addresses" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-semibold">Saved Addresses</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage delivery locations for quick checkout.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAddr(!showAddAddr)}
                  className="btn-primary !text-xs !py-2"
                >
                  <Plus size={15} /> Add Address
                </button>
              </div>

              {showAddAddr && (
                <form onSubmit={handleAddAddress} className="glass rounded-3xl p-6 space-y-4">
                  <h3 className="font-semibold text-lg">New Delivery Address</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Contact Name
                      </label>
                      <input
                        required
                        value={addrForm.name}
                        onChange={(e) => setAddrForm({ ...addrForm, name: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
                      <input
                        required
                        value={addrForm.phone}
                        onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Street Address / Lab / Building
                      </label>
                      <input
                        required
                        value={addrForm.address}
                        onChange={(e) => setAddrForm({ ...addrForm, address: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">City</label>
                      <input
                        required
                        value={addrForm.city}
                        onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">State</label>
                      <input
                        value={addrForm.state}
                        onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">PIN Code</label>
                      <input
                        required
                        value={addrForm.pincode}
                        onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })}
                        className="field"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button className="btn-primary !py-2 !text-xs">Save Address</button>
                    <button
                      type="button"
                      onClick={() => setShowAddAddr(false)}
                      className="btn-ghost !py-2 !text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {addresses.length === 0 ? (
                  <div className="sm:col-span-2">
                    <Empty
                      icon={MapPin}
                      title="No saved addresses"
                      text="Add your lab or workshop address for seamless one-click order placement."
                    >
                      <button onClick={() => setShowAddAddr(true)} className="btn-primary">
                        Add New Address
                      </button>
                    </Empty>
                  </div>
                ) : (
                  addresses.map((addr, idx) => (
                    <div key={idx} className="glass rounded-2xl p-5 relative">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <MapPin size={16} className="text-primary" /> {addr.name}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{addr.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                      <p className="mt-2 text-xs font-mono text-muted-foreground">
                        Phone: {addr.phone}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
