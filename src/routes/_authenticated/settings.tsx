import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut, Lock, KeyRound, ChevronRight, Shield, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { signOut, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState("");

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

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center safe-top">
        <Link to="/" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="ml-2 font-display font-bold">Settings</h1>
      </header>

      <div className="p-4 space-y-3">
        <Link to="/edit-profile" className="flex items-center gap-3 p-4 rounded-2xl glass">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <span className="flex-1 font-semibold">Edit profile</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>

        <Link to="/close-friends" className="flex items-center gap-3 p-4 rounded-2xl glass">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="flex-1 font-semibold">Close friends</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>

        <button onClick={togglePrivate} className="w-full flex items-center gap-3 p-4 rounded-2xl glass text-left">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <span className="flex-1 font-semibold">Private account</span>
          <span className={`w-10 h-6 rounded-full p-0.5 transition ${profile?.is_private ? "bg-gradient-brand" : "bg-muted"}`}>
            <span className={`block w-5 h-5 rounded-full bg-background transition ${profile?.is_private ? "translate-x-4" : ""}`} />
          </span>
        </button>

        <div className="p-4 rounded-2xl glass">
          <div className="flex items-center gap-3 mb-3">
            <KeyRound className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold">Change password</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              className="flex-1 bg-transparent border border-border rounded-xl px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={changePw} className="px-4 h-10 rounded-xl bg-gradient-brand text-primary-foreground font-semibold text-sm">
              Update
            </button>
          </div>
        </div>

        <button
          onClick={async () => { await signOut(); nav({ to: "/login" }); }}
          className="w-full flex items-center gap-3 p-4 rounded-2xl glass text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span className="flex-1 text-left font-semibold">Sign out</span>
        </button>
      </div>
    </div>
  );
}
