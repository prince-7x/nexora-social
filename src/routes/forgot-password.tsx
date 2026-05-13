import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Mail, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <Logo size="lg" />
        <h1 className="mt-6 text-2xl font-display font-bold">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll email you a secure link to set a new password.
        </p>

        {sent ? (
          <div className="mt-8 p-6 rounded-2xl glass">
            <p className="text-sm">Check <span className="font-semibold">{email}</span> for the reset link.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-3 text-left">
            <div className="flex items-center gap-3 px-4 h-12 rounded-2xl glass">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-gradient-brand text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-glow disabled:opacity-60"
            >
              {loading ? "Sending…" : <>Send reset link <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        <div className="mt-6">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
