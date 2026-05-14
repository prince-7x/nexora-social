import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Search, Check, Plus } from "lucide-react";
import { toast } from "sonner";

type Person = { id: string; username: string; avatar_url: string | null; full_name: string };

export const Route = createFileRoute("/_authenticated/close-friends")({
  component: CloseFriendsPage,
});

function CloseFriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<Person[]>([]);
  const [closeIds, setCloseIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: f } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("status", "accepted");
    const ids = (f ?? []).map((x: any) => x.following_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .in("id", ids);
      setFollowing((profs as Person[]) ?? []);
    } else setFollowing([]);

    const { data: cf } = await supabase
      .from("close_friends")
      .select("friend_id")
      .eq("user_id", user.id);
    setCloseIds(new Set((cf ?? []).map((x: any) => x.friend_id)));
  };

  useEffect(() => { load(); }, [user?.id]);

  const toggle = async (id: string) => {
    if (!user) return;
    if (closeIds.has(id)) {
      await supabase.from("close_friends").delete().eq("user_id", user.id).eq("friend_id", id);
      const next = new Set(closeIds); next.delete(id); setCloseIds(next);
    } else {
      await supabase.from("close_friends").insert({ user_id: user.id, friend_id: id });
      const next = new Set(closeIds); next.add(id); setCloseIds(next);
      toast.success("Added to close friends");
    }
  };

  const filtered = following.filter(
    (p) => !q || p.username.includes(q.toLowerCase()) || p.full_name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center safe-top">
        <Link to="/settings" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="ml-2 font-display font-bold">Close friends</h1>
      </header>
      <div className="px-4 pt-3 pb-4">
        <p className="text-sm text-muted-foreground">
          Only people on this list will see your close-friends-only stories. They won't be notified.
        </p>
        <div className="mt-3 flex items-center gap-2 px-3 h-11 rounded-2xl glass">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.toLowerCase())}
            placeholder="Search"
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
      </div>
      <ul className="px-2">
        {filtered.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-12">
            Follow someone first to add them
          </li>
        )}
        {filtered.map((p) => {
          const on = closeIds.has(p.id);
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
            >
              <Avatar url={p.avatar_url} username={p.username} size={44} ring />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.username}</div>
                <div className="text-xs text-muted-foreground truncate">{p.full_name}</div>
              </div>
              <button
                onClick={() => toggle(p.id)}
                className={`w-9 h-9 grid place-items-center rounded-full transition ${
                  on ? "bg-gradient-brand text-primary-foreground shadow-glow" : "glass"
                }`}
                aria-label={on ? "Remove" : "Add"}
              >
                {on ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
