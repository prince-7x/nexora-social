import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Check, Search, Users, X } from "lucide-react";
import { toast } from "sonner";

type Person = { id: string; username: string; avatar_url: string | null; full_name: string };

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroup,
});

function NewGroup() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Map<string, Person>>(new Map());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  // Default: load people the user follows. When searching: search all profiles by username.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const term = q.trim().toLowerCase();
    setLoading(true);
    (async () => {
      if (term.length === 0) {
        const { data: f } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .eq("status", "accepted");
        const ids = (f ?? []).map((x: any) => x.following_id);
        if (!ids.length) { if (!cancelled) { setResults([]); setLoading(false); } return; }
        const { data: p } = await supabase
          .from("profiles")
          .select("id,username,avatar_url,full_name")
          .in("id", ids)
          .limit(50);
        if (!cancelled) { setResults((p ?? []) as Person[]); setLoading(false); }
      } else {
        const { data: p } = await supabase
          .from("profiles")
          .select("id,username,avatar_url,full_name")
          .ilike("username", `%${term}%`)
          .neq("id", user.id)
          .limit(25);
        if (!cancelled) { setResults((p ?? []) as Person[]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [q, user?.id]);

  const toggle = (p: Person) => {
    setPicked((s) => {
      const n = new Map(s);
      n.has(p.id) ? n.delete(p.id) : n.set(p.id, p);
      return n;
    });
  };

  const create = async () => {
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Give it a name");
    if (picked.size === 0) return toast.error("Pick at least one person");
    setBusy(true);
    const { data: g, error } = await supabase
      .from("groups" as any)
      .insert({ name: name.trim(), created_by: user.id })
      .select("id")
      .single();
    if (error || !g) { setBusy(false); return toast.error(error?.message || "Failed"); }
    const rows = Array.from(picked.keys()).map((uid) => ({
      group_id: (g as any).id, user_id: uid, role: "member", status: "approved", added_by: user.id,
    }));
    await supabase.from("group_members" as any).insert(rows);
    toast.success("Group created");
    nav({ to: "/groups/$id", params: { id: (g as any).id } });
  };

  const pickedList = useMemo(() => Array.from(picked.values()), [picked]);

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

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
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

        {/* Picked chips */}
        {pickedList.length > 0 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {pickedList.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p)}
                className="shrink-0 flex flex-col items-center gap-1 relative"
              >
                <div className="relative">
                  <Avatar url={p.avatar_url} username={p.username} size={52} />
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive grid place-items-center">
                    <X className="w-3 h-3 text-white" />
                  </span>
                </div>
                <span className="text-[10px] font-medium max-w-[60px] truncate">{p.username}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 h-11 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {q.trim() ? "Search results" : "Suggested"} · {picked.size} selected
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {q.trim() ? "No users found." : "Follow people or search above."}
          </p>
        ) : (
          <ul className="space-y-1">
            {results.map((f) => {
              const on = picked.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    onClick={() => toggle(f)}
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
