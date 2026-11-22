import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CreditCard,
  Smartphone,
  Banknote,
  ShoppingBag,
  Loader2,
  MapPin,
  CheckCircle,
  Copy,
  RefreshCw,
  Download,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreProvider.jsx";
import { calcTotals, COUPONS, formatINR } from "@/lib/pricing.js";
import { placeOrder } from "@/services/orderService.js";
import { http } from "@/services/api.js";
import { Summary } from "./cart.jsx";
import { Page, Empty } from "@/components/Motion.jsx";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — NEXUS" },
      { name: "description", content: "Secure checkout for your components." },
      { property: "og:title", content: "Checkout — NEXUS" },
      { property: "og:description", content: "Secure checkout for your components." },
    ],
  }),
  component: Checkout,
});

const payments = [
  ["cod", "Cash on Delivery", Banknote, "Pay on delivery to courier"],
  ["upi", "UPI / QR Code", Smartphone, "GPay, PhonePe, Paytm"],
  ["card", "Credit / Debit Card", CreditCard, "Visa, Mastercard, RuPay"],
];

// ── UPI QR Panel ──────────────────────────────────────────────────────────────

function UpiPanel({ total, orderId, onPaid }) {
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const fetchQr = useCallback(async () => {
    if (!total) return;

    setLoading(true);
    setError("");

    try {
      const data = await http("/payments/upi-qr", {
        method: "POST",
        body: { amount: total, orderId, description: `NEXUS Order ${orderId}` },
      });

      if (!data.configured || !data.qrDataUrl) {
        setQr({ qrImageUrl: "/nexus-upi-qr.jpeg" });
        return;
      }

      setQr(data);
    } catch {
      setQr({ qrImageUrl: "/nexus-upi-qr.jpeg" });
    } finally {
      setLoading(false);
    }
  }, [total, orderId]);

  useEffect(() => {
    fetchQr();
  }, [fetchQr]);

  const copyUpi = async () => {
    if (!qr?.upiId) return;

    await navigator.clipboard.writeText(qr.upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="animate-spin" size={28} />
        <span className="text-sm">Generating QR code…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400 flex gap-3 items-start">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold mb-1">UPI Unavailable</div>
          <div className="text-xs text-amber-300/80">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* QR Code */}
      {(qr?.qrDataUrl || qr?.qrImageUrl) && (
        <div className="rounded-2xl border-2 border-primary/40 bg-white p-3 shadow-lg shadow-primary/10">
          <img
            src={qr.qrDataUrl || qr.qrImageUrl}
            alt="UPI QR Code"
            className="h-52 w-52 rounded-xl"
          />
        </div>
      )}

      {/* Amount badge */}
      <div className="rounded-full border border-primary/40 bg-primary/10 px-6 py-1.5 text-lg font-bold text-primary">
        Pay {formatINR(total)}
      </div>

      {/* Instructions */}
      <p className="text-center text-xs text-muted-foreground max-w-xs">
        Open <strong className="text-foreground">GPay / PhonePe / Paytm</strong>, scan the QR, and pay{" "}
        <strong className="text-primary">{formatINR(total)}</strong>.
      </p>

      {/* UPI ID copy */}
      {qr?.upiId && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm">
          <span className="text-muted-foreground text-xs">Or pay to:</span>
          <span className="font-mono font-semibold text-foreground">{qr.upiId}</span>
          <button
            onClick={copyUpi}
            className="ml-1 text-primary hover:text-primary/80 transition"
          >
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {/* Refresh + Confirm */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={fetchQr}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:border-primary transition"
        >
          <RefreshCw size={12} /> Refresh QR
        </button>

        <button
          type="button"
          onClick={onPaid}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary/90 transition"
        >
          <CheckCircle size={12} /> I've Paid
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground/60 text-center">
        After paying, click "I've Paid" to confirm your order.
      </p>
    </div>
  );
}

// ── Razorpay Card Panel ───────────────────────────────────────────────────────

function CardPanel({ total, orderDetails, onPaid }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const initiateRazorpay = async () => {
    setLoading(true);
    setError("");

    try {
      const config = await http("/payments/config");

      if (!config.card) {
        setError("Card payment is not configured. Please use COD or UPI.");
        setLoading(false);
        return;
      }

      const data = await http("/payments/create-order", {
        method: "POST",
        body: { amount: total, orderId: orderDetails.id || `NX${Date.now()}` },
      });

      if (!data.configured || !data.razorpayOrderId) {
        setError("Could not initialize card payment. Try COD or UPI.");
        setLoading(false);
        return;
      }

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "NEXUS Electronics",
        description: `Order ${orderDetails.id || ""}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: orderDetails.name || "",
          email: orderDetails.email || "",
          contact: orderDetails.phone || "",
        },
        theme: { color: "#10b981" },
        handler: async (response) => {
          try {
            const verification = await http("/payments/verify", {
              method: "POST",
              body: {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            });

            if (verification.verified) {
              toast.success("Payment verified successfully!");
              onPaid({ paymentId: response.razorpay_payment_id });
            } else {
              toast.error("Payment verification failed. Contact support.");
            }
          } catch {
            toast.error(
              "Could not verify payment. Contact support with payment ID: " +
                response.razorpay_payment_id
            );
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.info("Payment cancelled. You can try again.");
          },
        },
      });

      rzp.open();
    } catch (err) {
      setError("Failed to load payment gateway: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="rounded-xl border border-border/60 bg-surface/50 p-4 text-sm">
        <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <CreditCard size={16} className="text-primary" />
          Secure Card Payment via Razorpay
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>✓ Visa, Mastercard, RuPay, Amex</li>
          <li>✓ Net Banking &amp; Wallets</li>
          <li>✓ 256-bit SSL encrypted</li>
          <li>✓ No card details stored on NEXUS servers</li>
        </ul>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex gap-2 items-start">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={initiateRazorpay}
        disabled={loading}
        className="btn-primary flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Loading Gateway…
          </>
        ) : (
          <>
            <CreditCard size={16} /> Pay {formatINR(total)} with Card
          </>
        )}
      </button>
    </div>
  );
}

// ── Order Success Modal ───────────────────────────────────────────────────────

function OrderSuccessModal({ order, onClose }) {
  if (!order) return null;

  const downloadInvoice = () => {
    window.open(`/api/orders/${order.id}/invoice`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-surface p-8 shadow-2xl shadow-primary/10">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/30">
            <CheckCircle size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Order Placed!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your order has been confirmed.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-background/50 p-4 text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-widest">
            Order ID
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-primary">
            #{order.id}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {order.paymentMethod === "cod"
              ? "Pay on delivery. Our team will contact you soon."
              : "Payment received. Processing your order."}
          </div>
        </div>

        {order.userEmail && (
          <p className="mb-4 text-center text-xs text-muted-foreground">
            📧 Order confirmation &amp; invoice sent to{" "}
            <strong className="text-foreground">{order.userEmail}</strong>
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={downloadInvoice}
            className="btn-ghost flex items-center justify-center gap-2 !text-sm"
          >
            <Download size={15} /> Download Invoice PDF
          </button>

          <button onClick={onClose} className="btn-primary">
            View My Orders
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Checkout Component ───────────────────────────────────────────────────

function Checkout() {
  const { cart, clearCart, addOrder, user, ready } = useStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.name || user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState("");
  const [pay, setPay] = useState("cod");
  const [busy, setBusy] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [upiPaid, setUpiPaid] = useState(false);

  const totals = calcTotals(cart, coupon);

  // Sync user info when available
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.name || user.fullName || "",
        email: prev.email || user.email || "",
        phone: prev.phone || user.phone || "",
      }));

      if (user.addresses && user.addresses.length > 0 && !form.address) {
        const addr = user.addresses[0];

        setForm((prev) => ({
          ...prev,
          name: addr.name || prev.name,
          phone: addr.phone || prev.phone,
          address: addr.address || "",
          city: addr.city || "",
          state: addr.state || "",
          pincode: addr.pincode || "",
        }));
      }
    }
  }, [user]);

  const applyCoupon = () => {
    const cleanCode = code.trim().toUpperCase();

    if (COUPONS[cleanCode]) {
      setCoupon(cleanCode);
      toast.success(`Coupon ${cleanCode} applied!`);
    } else {
      toast.error("Invalid coupon code. Try NEXUS10 or MAKER20");
    }
  };

  const selectSavedAddress = (addr) => {
    setForm((prev) => ({
      ...prev,
      name: addr.name || prev.name,
      phone: addr.phone || prev.phone,
      address: addr.address,
      city: addr.city,
      state: addr.state || "",
      pincode: addr.pincode,
    }));

    toast.info(`Selected address: ${addr.city}`);
  };

  // Validate form fields
  const validateForm = () => {
    if (!form.phone || !/^\d{10}$/.test(form.phone.replace(/[^0-9]/g, ""))) {
      toast.error("Enter a valid 10-digit mobile number.");
      return false;
    }

    if (!form.pincode || !/^\d{6}$/.test(form.pincode.replace(/[^0-9]/g, ""))) {
      toast.error("Enter a valid 6-digit PIN code.");
      return false;
    }

    return true;
  };

  // Build order payload
  const buildPayload = (overridePayment) => ({
    userId: user ? user.uid : null,
    userEmail: user ? user.email : form.email,
    items: cart,
    shipping: form,
    payment: overridePayment || pay,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    shippingFee: totals.shipping,
    gst: totals.gst,
    total: totals.total,
  });

  // Finalize (create) order after payment is done
  const finalizeOrder = async (overridePayment, extraStatus) => {
    setBusy(true);

    try {
      const payload = buildPayload(overridePayment);
      if (extraStatus) payload.paymentStatus = extraStatus;

      const order = await placeOrder(payload);

      addOrder(order);
      clearCart();
      setPendingOrder(null);
      setSuccessOrder(order);
    } catch (err) {
      toast.error(err.message || "Failed to place order. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Main form submit
  const submit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (pay === "cod") {
      await finalizeOrder("cod");
    } else if (pay === "upi") {
      setUpiPaid(false);
      setPendingOrder({
        id: `NX${Date.now().toString().slice(-8)}-PENDING`,
        totals,
        form,
        payment: "upi",
      });
    } else if (pay === "card") {
      setPendingOrder({
        id: `NX${Date.now().toString().slice(-8)}-PENDING`,
        totals,
        form,
        payment: "card",
      });
    }
  };

  // UPI: user confirmed payment
  const handleUpiPaid = async () => {
    toast.info("Confirming your order…");
    await finalizeOrder("upi", "Paid via UPI (self-reported)");
  };

  // Card: Razorpay verified payment
  const handleCardPaid = async ({ paymentId }) => {
    await finalizeOrder("card", `Paid via Card — Razorpay ${paymentId}`);
  };

  // After success modal close
  const handleSuccessClose = () => {
    setSuccessOrder(null);
    navigate({ to: "/profile" });
  };

  if (ready && cart.length === 0 && !successOrder) {
    return (
      <Page>
        <Empty
          icon={ShoppingBag}
          title="Nothing to check out"
          text="Your cart is currently empty."
        >
          <Link to="/products" className="btn-primary">
            Browse Components
          </Link>
        </Empty>
      </Page>
    );
  }

  const f = (k, label, props = {}) => (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted-foreground">{label}</span>
      <input
        required
        value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="field"
        {...props}
      />
    </label>
  );

  return (
    <Page>
      {/* Success Modal */}
      {successOrder && (
        <OrderSuccessModal order={successOrder} onClose={handleSuccessClose} />
      )}

      <form
        onSubmit={submit}
        className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_380px]"
      >
        <div className="space-y-8">
          <div>
            <span className="eyebrow">Checkout</span>
            <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
              Shipping &amp; Payment
            </h1>
          </div>

          {/* Saved Addresses Selector */}
          {user && user.addresses && user.addresses.length > 0 && (
            <section className="glass rounded-3xl p-6">
              <h2 className="mb-3 font-semibold text-sm flex items-center gap-2">
                <MapPin size={16} className="text-primary" /> Use Saved Address
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {user.addresses.map((addr, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => selectSavedAddress(addr)}
                    className="rounded-2xl border border-border p-3 text-left text-xs transition hover:border-primary focus:border-primary"
                  >
                    <div className="font-semibold text-foreground">{addr.name}</div>
                    <div className="mt-1 text-muted-foreground truncate">
                      {addr.address}
                    </div>
                    <div className="text-muted-foreground">
                      {addr.city} - {addr.pincode}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Shipping Form */}
          <section className="glass rounded-3xl p-6">
            <h2 className="mb-5 font-semibold text-lg">Delivery Information</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {f("name", "Full Name / Receiver")}
              {f("phone", "Mobile Phone", {
                inputMode: "numeric",
                placeholder: "9876543210",
              })}

              <div className="sm:col-span-2">
                {f("email", "Email Address (for order tracking & invoice)", {
                  type: "email",
                })}
              </div>

              <div className="sm:col-span-2">
                {f("address", "Street Address, Lab, or Apartment")}
              </div>

              {f("city", "City")}
              {f("state", "State")}
              {f("pincode", "PIN Code", {
                inputMode: "numeric",
                placeholder: "560001",
              })}
            </div>
          </section>

          {/* Payment Method */}
          <section className="glass rounded-3xl p-6">
            <h2 className="mb-2 font-semibold text-lg">Payment Method</h2>
            <p className="mb-5 text-xs text-muted-foreground">
              Choose your preferred payment method.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {payments.map(([id, label, Icon, blurb]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setPay(id)}
                  className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                    pay === id
                      ? "border-primary bg-accent/50 glow"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Icon
                    size={20}
                    className={pay === id ? "text-primary" : "text-muted-foreground"}
                  />
                  <div className="font-semibold text-sm text-foreground">{label}</div>
                  <div className="text-[11px] text-muted-foreground">{blurb}</div>
                </button>
              ))}
            </div>

            {/* Dynamic payment info panel */}
            {pendingOrder && pay === "upi" && (
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <h3 className="mb-4 text-sm font-semibold text-primary">Scan to Pay</h3>
                <UpiPanel
                  total={totals.total}
                  orderId={pendingOrder.id}
                  onPaid={handleUpiPaid}
                />
              </div>
            )}

            {pendingOrder && pay === "card" && (
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <h3 className="mb-4 text-sm font-semibold text-primary">Card Payment</h3>
                <CardPanel
                  total={totals.total}
                  orderDetails={{ id: pendingOrder.id, ...form }}
                  onPaid={handleCardPaid}
                />
              </div>
            )}

            {!pendingOrder && (
              <div className="mt-4 rounded-xl border border-border/60 bg-surface/50 p-3 text-xs text-muted-foreground">
                {pay === "cod" ? (
                  <span>
                    Cash on Delivery is available across all serviceable PIN codes in India.
                  </span>
                ) : pay === "upi" ? (
                  <span>
                    A UPI QR code will appear after you fill in delivery details and proceed.
                  </span>
                ) : (
                  <span>
                    Secure card payment via Razorpay. Gateway opens after you proceed.
                  </span>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Order Summary */}
        <Summary totals={totals}>
          <ul className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm max-h-60 overflow-y-auto pr-1">
            {cart.map((i) => (
              <li
                key={i.id}
                className="flex justify-between items-center gap-2 text-muted-foreground text-xs"
              >
                <span className="truncate max-w-[200px]">
                  {i.qty} × {i.name}
                </span>
                <span className="font-mono text-foreground">
                  {formatINR(i.qty * i.price)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Coupon (NEXUS10 / MAKER20)"
              className="field !py-2 text-xs"
            />
            <button
              type="button"
              onClick={applyCoupon}
              className="btn-ghost !px-4 !py-2 !text-xs shrink-0"
            >
              Apply
            </button>
          </div>

          {/* Only show Place Order for COD (UPI/Card have their own flow) */}
          {!pendingOrder && (
            <button disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : pay === "cod" ? (
                `Place Order · ${formatINR(totals.total)}`
              ) : (
                `Proceed to ${pay === "upi" ? "UPI" : "Card"} · ${formatINR(totals.total)}`
              )}
            </button>
          )}

          {pendingOrder && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingOrder(null)}
              className="btn-ghost mt-3 w-full !text-xs"
            >
              ← Change Payment Method
            </button>
          )}
        </Summary>
      </form>
    </Page>
  );
}