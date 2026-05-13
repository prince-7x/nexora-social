import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { Heart, MessageCircle, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";

type Notif = {
  id: string;
  type: "like" | "comment" | "follow" | "follow_request" | "follow_accepted" | "message";
  actor_id: string;
  post_id: string | null;
  read: boolean;
  created_at: string;
  actor: { username: string; avatar_url: string | null };
  post?: { image_url: string } | null;
};

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [requests, setRequests] = useState<{ id: string; follower_id: string; follower: { username: string; avatar_url: string | null } }[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: notifs } = await supabase
      .from("notifications")
      .select("id,type,actor_id,post_id,read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const actorIds = Array.from(new Set((notifs ?? []).map((n) => n.actor_id)));
    const postIds = Array.from(new Set((notifs ?? []).map((n) => n.post_id).filter(Boolean) as string[]));
    const [{ data: actors }, { data: posts }] = await Promise.all([
      actorIds.length ? supabase.from("profiles").select("id,username,avatar_url").in("id", actorIds) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("posts").select("id,image_url").in("id", postIds) : Promise.resolve({ data: [] }),
    ]);
    const aMap = new Map((actors ?? []).map((a: any) => [a.id, a]));
    const pMap = new Map((posts ?? []).map((p: any) => [p.id, p]));
    setItems(
      (notifs ?? []).map((n) => ({
        ...n,
        actor: aMap.get(n.actor_id) ?? { username: "user", avatar_url: null },
        post: n.post_id ? pMap.get(n.post_id) : null,
      })) as Notif[]
    );

    // mark as read
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);

    // pending follow requests
    const { data: reqs } = await supabase
      .from("follows")
      .select("id,follower_id")
      .eq("following_id", user.id)
      .eq("status", "pending");
    if (reqs?.length) {
      const ids = reqs.map((r) => r.follower_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids);
      const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setRequests(reqs.map((r) => ({ id: r.id, follower_id: r.follower_id, follower: m.get(r.follower_id) ?? { username: "user", avatar_url: null } })));
    } else {
      setRequests([]);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const accept = async (id: string, followerId: string) => {
    await supabase.from("follows").update({ status: "accepted" }).eq("id", id);
    if (user) {
      await supabase.from("notifications").insert({ user_id: followerId, actor_id: user.id, type: "follow_accepted" });
    }
    toast.success("Accepted");
    load();
  };
  const reject = async (id: string) => {
    await supabase.from("follows").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-4 h-14 flex items-center safe-top">
        <h1 className="text-xl font-display font-bold">Activity</h1>
      </header>

      {requests.length > 0 && (
        <section className="px-4 py-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Follow requests</h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl glass">
                <Link to="/u/$username" params={{ username: r.follower.username }}>
                  <Avatar url={r.follower.avatar_url} username={r.follower.username} size={40} ring />
                </Link>
                <Link to="/u/$username" params={{ username: r.follower.username }} className="flex-1 font-semibold text-sm">
                  {r.follower.username}
                </Link>
                <button onClick={() => accept(r.id, r.follower_id)} className="p-2 rounded-full bg-gradient-brand text-primary-foreground">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => reject(r.id)} className="p-2 rounded-full glass">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <ul className="px-2 py-2">
        {items.length === 0 && requests.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-20">No activity yet</li>
        )}
        {items.map((n) => (
          <li key={n.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl">
            <Link to="/u/$username" params={{ username: n.actor.username }}>
              <Avatar url={n.actor.avatar_url} username={n.actor.username} size={40} ring />
            </Link>
            <div className="flex-1 text-sm min-w-0">
              <Link to="/u/$username" params={{ username: n.actor.username }} className="font-semibold">
                {n.actor.username}
              </Link>{" "}
              <span className="text-muted-foreground">{label(n.type)}</span>
            </div>
            <NotifIcon type={n.type} />
            {n.post?.image_url && (
              <Link to="/p/$id" params={{ id: n.post_id! }}>
                <img src={n.post.image_url} className="w-12 h-12 rounded-lg object-cover" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function label(t: Notif["type"]) {
  switch (t) {
    case "like": return "liked your post";
    case "comment": return "commented on your post";
    case "follow": return "started following you";
    case "follow_request": return "requested to follow you";
    case "follow_accepted": return "accepted your follow request";
    case "message": return "sent you a message";
  }
}
function NotifIcon({ type }: { type: Notif["type"] }) {
  if (type === "like") return <Heart className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />;
  if (type === "comment") return <MessageCircle className="w-4 h-4 text-muted-foreground" />;
  return <UserPlus className="w-4 h-4 text-muted-foreground" />;
}
