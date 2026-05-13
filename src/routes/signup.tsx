import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { User, AtSign, Mail, Lock, ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { z } from "zod";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const schema = z.object({
  full_name: z.string().trim().min(1).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_.]+$/i, "letters, numbers, _ or . only"),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

function SignupPage() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", username: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) nav({ to: "/" });
  }, [loading, session, nav]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    // check username uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", form.username)
      .maybeSingle();
    if (existing) {
      setSubmitting(false);
      return toast.error("Username taken");
    }

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: form.username, full_name: form.full_name },
      },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Welcome to ${BRAND.name}`);
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="mt-2 text-sm text-muted-foreground">Create your account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field icon={<User className="w-4 h-4" />}>
            <input required placeholder="Full name" value={form.full_name} onChange={update("full_name")}
              className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground" />
          </Field>
          <Field icon={<AtSign className="w-4 h-4" />}>
            <input required placeholder="Username" value={form.username} onChange={update("username")}
              className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground" />
          </Field>
          <Field icon={<Mail className="w-4 h-4" />}>
            <input type="email" required placeholder="Email" value={form.email} onChange={update("email")}
              className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground" />
          </Field>
          <Field icon={<Lock className="w-4 h-4" />}>
            <input type="password" required placeholder="Password (min 8 chars)" value={form.password} onChange={update("password")}
              className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground" />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-2xl bg-gradient-brand text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-glow disabled:opacity-60"
          >
            {submitting ? "Creating…" : <>Create account <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-gradient font-semibold">Sign in</Link>
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
