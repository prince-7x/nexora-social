import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Crown, LogOut, Trash2, UserMinus, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";

type Member = {
  user_id: string;
  role: "admin" | "member";
  status: "pending" | "approved";
  profile?: { username: string; avatar_url: string | null; full_name: string };
};

export const Route = createFileRoute("/_authenticated/groups/$id/members")({
  component: Members,
});

function Members() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { id } = useParams({ from: "/_authenticated/groups/$id/members" });
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meAdmin, setMeAdmin] = useState(false);
  const [friends, setFriends] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const [{ data }, { data: g }] = await Promise.all([
      supabase.from("group_members" as any).select("user_id,role,status").eq("group_id", id),
      supabase.from("groups" as any).select("created_by").eq("id", id).maybeSingle(),
    ]);
    setCreatorId(((g as any)?.created_by ?? null));
    const rows = ((data ?? []) as unknown) as Member[];
    const ids = rows.map((r) => r.user_id);
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id,username,avatar_url,full_name").in("id", ids);
      const m = new Map((p ?? []).map((x: any) => [x.id, x]));
      rows.forEach((r) => { r.profile = m.get(r.user_id) as any; });
    }
    setMembers(rows);
    const me = rows.find((r) => r.user_id === user?.id);
    setMeAdmin(me?.role === "admin" && me?.status === "approved");
  };

  useEffect(() => { load(); }, [id, user?.id]);

  const leaveGroup = async () => {
    if (!user) return;
    if (!confirm("Leave this group?")) return;
    await supabase.from("group_members" as any).delete().eq("group_id", id).eq("user_id", user.id);
    toast.success("Left group");
    nav({ to: "/groups" });
  };

  const deleteGroup = async () => {
    if (!confirm("Delete this group for everyone? This cannot be undone.")) return;
    await supabase.from("group_messages" as any).delete().eq("group_id", id);
    await supabase.from("group_members" as any).delete().eq("group_id", id);
    await supabase.from("groups" as any).delete().eq("id", id);
    toast.success("Group deleted");
    nav({ to: "/groups" });
  };


  const loadFriends = async () => {
    if (!user) return;
    const { data: f } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("status", "accepted");
    const ids = (f ?? []).map((x: any) => x.following_id);
    const have = new Set(members.map((m) => m.user_id));
    const fresh = ids.filter((x) => !have.has(x));
    if (!fresh.length) { setFriends([]); return; }
    const { data: p } = await supabase.from("profiles").select("id,username,avatar_url").in("id", fresh);
    setFriends((p ?? []) as any);
  };

  const addMember = async (uid: string) => {
    await supabase.from("group_members" as any).insert({
      group_id: id, user_id: uid, role: "member", status: "approved", added_by: user!.id,
    });
    toast.success("Added");
    setShowAdd(false);
    load();
  };

  const remove = async (uid: string) => {
    await supabase.from("group_members" as any).delete().eq("group_id", id).eq("user_id", uid);
    toast.success("Removed");
    load();
  };

  const makeAdmin = async (uid: string) => {
    await supabase.from("group_members" as any).update({ role: "admin" }).eq("group_id", id).eq("user_id", uid);
    toast.success("Promoted to admin");
    load();
  };

  const approve = async (uid: string) => {
    await supabase.from("group_members" as any).update({ status: "approved" }).eq("group_id", id).eq("user_id", uid);
    load();
  };

  const pending = members.filter((m) => m.status === "pending");
  const approved = members.filter((m) => m.status === "approved");

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center justify-between safe-top">
        <Link to="/groups/$id" params={{ id }} className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display font-bold">Members</h1>
        {meAdmin ? (
          <button
            onClick={() => { setShowAdd((s) => !s); if (!showAdd) loadFriends(); }}
            className="p-2 -mr-1"
          >
            <UserPlus className="w-5 h-5 text-primary" />
          </button>
        ) : <span className="w-9" />}
      </header>

      <div className="p-4 space-y-4">
        {showAdd && meAdmin && (
          <div className="glass rounded-2xl p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Add member</div>
            {friends.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No friends left to add.</p>
            ) : friends.map((f) => (
              <button key={f.id} onClick={() => addMember(f.id)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                <Avatar url={f.avatar_url} username={f.username} size={36} />
                <span className="flex-1 text-left text-sm font-semibold">{f.username}</span>
                <span className="text-xs text-primary font-bold">Add</span>
              </button>
            ))}
          </div>
        )}

        {pending.length > 0 && meAdmin && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Pending</div>
            <ul className="glass rounded-2xl divide-y divide-white/5">
              {pending.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 p-3">
                  <Avatar url={m.profile?.avatar_url ?? null} username={m.profile?.username ?? "u"} size={40} />
                  <span className="flex-1 text-sm font-semibold">{m.profile?.username}</span>
                  <button onClick={() => approve(m.user_id)} className="w-8 h-8 rounded-full bg-gradient-brand grid place-items-center"><Check className="w-4 h-4 text-primary-foreground" /></button>
                  <button onClick={() => remove(m.user_id)} className="w-8 h-8 rounded-full bg-white/5 grid place-items-center"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            {approved.length} member{approved.length !== 1 ? "s" : ""}
          </div>
          <ul className="glass rounded-2xl divide-y divide-white/5">
            {approved.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 p-3">
                <Avatar url={m.profile?.avatar_url ?? null} username={m.profile?.username ?? "u"} size={40} ring={m.role === "admin"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">{m.profile?.username}</span>
                    {m.role === "admin" && <Crown className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.profile?.full_name}</div>
                </div>
                {meAdmin && m.user_id !== user?.id && (
                  <>
                    {m.role !== "admin" && (
                      <button onClick={() => makeAdmin(m.user_id)} className="text-[11px] px-2.5 h-7 rounded-full bg-white/5 font-semibold">
                        Promote
                      </button>
                    )}
                    <button onClick={() => remove(m.user_id)} className="w-8 h-8 rounded-full bg-destructive/15 grid place-items-center">
                      <UserMinus className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-2 space-y-2">
          <button
            onClick={leaveGroup}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-white/5 border border-white/10 text-sm font-semibold text-destructive"
          >
            <LogOut className="w-4 h-4" /> Leave group
          </button>
          {creatorId === user?.id && (
            <button
              onClick={deleteGroup}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-destructive/15 border border-destructive/30 text-sm font-bold text-destructive"
            >
              <Trash2 className="w-4 h-4" /> Delete group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
