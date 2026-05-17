import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Check, Users } from "lucide-react";
import { toast } from "sonner";

type Friend = { id: string; username: string; avatar_url: string | null; full_name: string };

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroup,
});

function NewGroup() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // people the user follows (accepted)
      const { data: f } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .eq("status", "accepted");
      const ids = (f ?? []).map((x: any) => x.following_id);
      if (!ids.length) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .in("id", ids);
      setFriends((p ?? []) as Friend[]);
    })();
  }, [user?.id]);

  const toggle = (id: string) => {
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const create = async () => {
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Give it a name");
    if (picked.size === 0) return toast.error("Pick at least one friend");
    setBusy(true);
    const { data: g, error } = await supabase
      .from("groups" as any)
      .insert({ name: name.trim(), created_by: user.id })
      .select("id")
      .single();
    if (error || !g) { setBusy(false); return toast.error(error?.message || "Failed"); }
    const rows = Array.from(picked).map((uid) => ({
      group_id: (g as any).id, user_id: uid, role: "member", status: "approved", added_by: user.id,
    }));
    await supabase.from("group_members" as any).insert(rows);
    toast.success("Group created");
    nav({ to: "/groups/$id", params: { id: (g as any).id } });
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center justify-between safe-top">
        <Link to="/groups" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display font-bold">New group</h1>
        <button
          disabled={busy}
          onClick={create}
          className="px-3 h-9 rounded-full bg-gradient-brand text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          Create
        </button>
      </header>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-brand-soft grid place-items-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 h-12 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Add members ({picked.size})
        </div>
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Follow people first to add them here.</p>
        ) : (
          <ul className="space-y-1">
            {friends.map((f) => {
              const on = picked.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    onClick={() => toggle(f.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted/40 transition"
                  >
                    <Avatar url={f.avatar_url} username={f.username} size={44} />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-semibold text-sm">{f.username}</div>
                      <div className="text-xs text-muted-foreground truncate">{f.full_name}</div>
                    </div>
                    <span className={`w-6 h-6 rounded-full grid place-items-center border-2 transition ${on ? "bg-gradient-brand border-transparent" : "border-white/20"}`}>
                      {on && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
