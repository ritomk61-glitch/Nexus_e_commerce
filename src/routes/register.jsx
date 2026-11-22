import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { register, loginWithGoogle } from "@/services/authService.js";
import { useStore } from "@/store/StoreProvider.jsx";
import { AuthShell } from "@/components/AuthShell.jsx";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — NEXUS" },
      { name: "description", content: "Create your NEXUS account." },
      { property: "og:title", content: "Create account — NEXUS" },
      { property: "og:description", content: "Create your NEXUS account." },
    ],
  }),
  component: Register,
});

function Register() {
  const store = useStore();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!f.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!f.email.trim() || !/\S+@\S+\.\S+/.test(f.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!f.password || f.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (f.password !== f.confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setBusy(true);
    try {
      const { user, verificationEmailSent } = await register({
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
      });
      store.login(user);
      if (verificationEmailSent) {
        toast.success("Account created! Check your inbox to verify your email.", { duration: 6000 });
      } else {
        toast.success("Account created successfully!");
      }
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleBusy(true);
    setError("");
    try {
      const { user } = await loginWithGoogle();
      store.login(user);
      toast.success("Account connected via Google!");
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Join 40,000+ engineers building next-generation hardware with NEXUS."
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Full name</label>
          <input
            required
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Dr. Rajesh Raman"
            className="field"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Email address</label>
          <input
            type="email"
            required
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            placeholder="rajesh@hardware.in"
            className="field"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Password</label>
            <input
              type="password"
              required
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              placeholder="Min 6 chars"
              className="field"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Confirm</label>
            <input
              type="password"
              required
              value={f.confirmPassword}
              onChange={(e) => setF({ ...f, confirmPassword: e.target.value })}
              placeholder="Confirm"
              className="field"
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button disabled={busy || googleBusy} className="btn-primary mt-2 w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Create account"}
        </button>
      </form>

      <div className="relative my-5 text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-background px-3">or continue with</span>
        <div className="absolute inset-0 top-1/2 border-t border-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignup}
        disabled={googleBusy || busy}
        className="glass flex w-full items-center justify-center gap-3 rounded-full py-2.5 text-sm font-medium transition hover:border-primary"
      >
        {googleBusy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            Sign up with Google
          </>
        )}
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
