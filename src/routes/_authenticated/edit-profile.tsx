import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { uploadFile } from "@/lib/upload";
import { ArrowLeft, Camera } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/edit-profile")({
  component: EditProfilePage,
});

function EditProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", username: "", bio: "", avatar_url: null as string | null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name,
      username: profile.username,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
    });
  }, [profile]);

  const onAvatar = async (file: File) => {
    if (!user) return;
    try {
      const url = await uploadFile("avatars", user.id, file);
      setForm((f) => ({ ...f, avatar_url: url }));
    } catch (e: any) { toast.error(e.message); }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim().slice(0, 80),
      username: form.username.trim().toLowerCase().slice(0, 24),
      bio: form.bio.slice(0, 300),
      avatar_url: form.avatar_url,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Saved");
    nav({ to: "/u/$username", params: { username: form.username } });
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center justify-between safe-top">
        <Link to="/settings" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-semibold">Edit profile</h1>
        <button onClick={save} disabled={saving} className="text-sm font-semibold text-gradient">{saving ? "Saving…" : "Save"}</button>
      </header>

      <div className="p-6 space-y-5">
        <div className="flex flex-col items-center gap-2">
          <label className="relative cursor-pointer">
            <Avatar url={form.avatar_url} username={form.username} size={96} ring />
            <span className="absolute bottom-0 right-0 p-2 rounded-full bg-gradient-brand text-primary-foreground shadow-glow">
              <Camera className="w-4 h-4" />
            </span>
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])} />
          </label>
        </div>

        <Field label="Full name">
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="bg-transparent w-full outline-none text-sm" />
        </Field>
        <Field label="Username">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="bg-transparent w-full outline-none text-sm" />
        </Field>
        <Field label="Bio">
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3}
            className="bg-transparent w-full outline-none text-sm resize-none" />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 rounded-2xl glass">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
