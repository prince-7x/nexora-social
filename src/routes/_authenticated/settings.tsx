import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import {
  ArrowLeft, LogOut, Lock, KeyRound, ChevronRight, Shield, Users,
  Palette, Bell, MessageSquare, HelpCircle, Sparkles, BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { THEMES, applyTheme, type ThemeId } from "@/lib/themes";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon, label, sub, onClick, to, right, danger,
}: {
  icon: any; label: string; sub?: string;
  onClick?: () => void; to?: string;
  right?: React.ReactNode; danger?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5 active:bg-white/5 transition">
      <span className={`grid place-items-center w-9 h-9 rounded-xl ${danger ? "bg-destructive/15 text-destructive" : "bg-white/5 text-foreground"}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${danger ? "text-destructive" : ""}`}>{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
      </div>
      {right ?? <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return <button onClick={onClick} className="w-full text-left">{inner}</button>;
}

function SettingsPage() {
  const { signOut, profile, refreshProfile, user } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [theme, setTheme] = useState<ThemeId>(
    (typeof document !== "undefined"
      ? (document.documentElement.getAttribute("data-theme") as ThemeId)
      : "amoled-pink") || "amoled-pink"
  );

  const togglePrivate = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ is_private: !profile.is_private }).eq("id", profile.id);
    await refreshProfile();
    toast.success(`Account is now ${!profile.is_private ? "private" : "public"}`);
  };

  const changePw = async () => {
    if (pw.length < 8) return toast.error("Min 8 characters");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    setPw("");
    toast.success("Password updated");
  };

  const pickTheme = async (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    if (user) {
      await (supabase.from("profiles") as any).update({ theme: id }).eq("id", user.id);
    }
    toast.success("Theme applied");
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center safe-top">
        <Link to="/" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="ml-2 font-display font-bold text-lg">Settings</h1>
      </header>

      {/* Profile hero */}
      {profile && (
        <Link
          to="/u/$username"
          params={{ username: profile.username }}
          className="block mx-4 mt-4 p-4 rounded-2xl glass-strong relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-30 bg-gradient-brand-soft pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <Avatar url={profile.avatar_url} username={profile.username} size={56} ring />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="font-display font-bold truncate">{profile.full_name || profile.username}</div>
                {profile.is_verified && <BadgeCheck className="w-4 h-4 text-primary fill-primary/20" />}
              </div>
              <div className="text-xs text-muted-foreground truncate">@{profile.username}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      )}

      <div className="p-4">
        <Section title="Account">
          <Row icon={Shield} label="Edit profile" sub="Name, bio, avatar" to="/edit-profile" />
          <Row icon={Lock} label="Private account" sub="Approve who can follow you"
            onClick={togglePrivate}
            right={
              <span className={`w-11 h-6 rounded-full p-0.5 transition ${profile?.is_private ? "bg-gradient-brand" : "bg-muted"}`}>
                <span className={`block w-5 h-5 rounded-full bg-background transition ${profile?.is_private ? "translate-x-5" : ""}`} />
              </span>
            }
          />
          <Row icon={Users} label="Close friends" sub="Your inner circle for stories" to="/close-friends" />
        </Section>

        <Section title="Appearance">
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Theme</span>
              <Sparkles className="w-3.5 h-3.5 text-primary ml-auto" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => pickTheme(t.id)}
                    className={`relative text-left rounded-xl p-3 border transition overflow-hidden ${
                      active ? "border-primary shadow-glow" : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{ background: t.gradient }}
                    />
                    <div className="relative">
                      <div
                        className="w-full h-10 rounded-lg mb-2"
                        style={{ background: t.gradient }}
                      />
                      <div className="text-xs font-bold">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{t.desc}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Messaging">
          <Row icon={MessageSquare} label="Group chats" sub="Create and manage groups" to="/groups" />
          <Row icon={Bell} label="Notifications" sub="Likes, comments, follows" to="/notifications" />
        </Section>

        <Section title="Security">
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Change password</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="New password (min 8)"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button onClick={changePw} className="px-4 h-10 rounded-xl bg-gradient-brand text-primary-foreground font-semibold text-sm">
                Update
              </button>
            </div>
          </div>
        </Section>

        <Section title="About">
          <Row icon={HelpCircle} label="About Nexora" sub="v1.0 • Premium social" onClick={() => toast("Made with 💜 on Lovable")} />
        </Section>

        <Section title="">
          <Row icon={LogOut} danger label="Sign out"
            onClick={async () => { await signOut(); nav({ to: "/login" }); }}
            right={<span />}
          />
        </Section>

        <p className="text-center text-[10px] text-muted-foreground mt-2 mb-6">Nexora · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
