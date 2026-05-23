import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { GoogleButton } from "@/components/GoogleButton";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) nav({ to: "/" });
  }, [loading, session, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <Logo size="xl" />
          <p className="mt-3 text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field icon={<Mail className="w-4 h-4" />}>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground"
            />
          </Field>
          <Field icon={<Lock className="w-4 h-4" />}>
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground"
            />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-2xl bg-gradient-brand text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-glow disabled:opacity-60"
          >
            {submitting ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <div className="mt-5">
          <GoogleButton label="Continue with Google" />
        </div>


        <div className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          New to {BRAND.name}?{" "}
          <Link to="/signup" className="text-gradient font-semibold">Create an account</Link>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 h-12 rounded-2xl glass focus-within:ring-2 focus-within:ring-primary/40 transition">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}
