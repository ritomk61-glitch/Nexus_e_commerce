import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { login, loginWithGoogle, forgotPassword } from "@/services/authService.js";
import { useStore } from "@/store/StoreProvider.jsx";
import { AuthShell } from "@/components/AuthShell.jsx";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — NEXUS" },
      { name: "description", content: "Sign in to your NEXUS account." },
      { property: "og:title", content: "Sign in — NEXUS" },
      { property: "og:description", content: "Sign in to your NEXUS account." },
    ],
  }),
  component: Login,
});

function Login() {
  const store = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { user } = await login({ email: email.trim(), password });
      store.login(user);
      toast.success(`Welcome back, ${user.name || user.email}`);
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleBusy(true);
    setError("");
    try {
      const { user } = await loginWithGoogle();
      store.login(user);
      toast.success(`Welcome, ${user.name || user.email}`);
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail || !/\S+@\S+\.\S+/.test(targetEmail)) {
      toast.error("Please enter a valid email address for password reset.");
      return;
    }
    try {
      await forgotPassword(targetEmail);
      setResetSent(true);
      toast.success("Password reset instructions sent to your email!");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to track orders, save BOMs, and access developer tools."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="engineer@lab.in"
            className="field"
            autoComplete="email"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Password</label>
            <button
              type="button"
              onClick={() => {
                setShowReset(!showReset);
                setResetEmail(email);
              }}
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button disabled={busy || googleBusy} className="btn-primary w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Sign in"}
        </button>
      </form>

      {/* Google Login */}
      <div className="relative my-6 text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-background px-3">or continue with</span>
        <div className="absolute inset-0 top-1/2 border-t border-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
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
            Sign in with Google
          </>
        )}
      </button>

      {/* Forgot Password Flow */}
      {showReset && (
        <div className="glass mt-6 rounded-2xl p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <KeyRound size={16} className="text-primary" /> Reset your password
          </div>
          {resetSent ? (
            <p className="mt-2 text-xs text-primary">Instructions sent! Please check your inbox.</p>
          ) : (
            <form onSubmit={handleForgotPassword} className="mt-3 space-y-2">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Enter registered email"
                className="field !py-2 text-xs"
              />
              <button className="btn-primary !py-2 !text-xs w-full">Send Reset Link</button>
            </form>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
