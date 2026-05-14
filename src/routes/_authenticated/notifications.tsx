import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { Heart, MessageCircle, UserPlus, Check, X, Ban, Send } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { followBack, blockUser, canMessage } from "@/lib/social";

type Notif = {
  id: string;
  type: "like" | "comment" | "follow" | "follow_request" | "follow_accepted" | "message";
  actor_id: string;
  post_id: string | null;
  read: boolean;
  created_at: string;
  actor: { username: string; avatar_url: string | null; is_private: boolean };
  post?: { image_url: string } | null;
  // local UI state
  iFollowBack?: boolean;
};

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [requests, setRequests] = useState<
    { id: string; follower_id: string; follower: { username: string; avatar_url: string | null } }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: notifs }, { data: reqs }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,type,actor_id,post_id,read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("follows")
        .select("id,follower_id")
        .eq("following_id", user.id)
        .eq("status", "pending"),
    ]);

    const actorIds = Array.from(new Set((notifs ?? []).map((n) => n.actor_id)));
    const requestActorIds = (reqs ?? []).map((r) => r.follower_id);
    const allIds = Array.from(new Set([...actorIds, ...requestActorIds]));
    const postIds = Array.from(
      new Set((notifs ?? []).map((n) => n.post_id).filter(Boolean) as string[])
    );

    const [{ data: profs }, { data: posts }, { data: myFollowing }] = await Promise.all([
      allIds.length
        ? supabase.from("profiles").select("id,username,avatar_url,is_private").in("id", allIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from("posts").select("id,image_url").in("id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      actorIds.length
        ? supabase
            .from("follows")
            .select("following_id,status")
            .eq("follower_id", user.id)
            .in("following_id", actorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const postMap = new Map((posts ?? []).map((p: any) => [p.id, p]));
    const followMap = new Map((myFollowing ?? []).map((f: any) => [f.following_id, f.status]));

    setItems(
      (notifs ?? []).map((n) => ({
        ...n,
        actor: profMap.get(n.actor_id) ?? {
          username: "user",
          avatar_url: null,
          is_private: false,
        },
        post: n.post_id ? postMap.get(n.post_id) : null,
        iFollowBack: !!followMap.get(n.actor_id),
      })) as Notif[]
    );

    setRequests(
      (reqs ?? []).map((r) => ({
        id: r.id,
        follower_id: r.follower_id,
        follower: profMap.get(r.follower_id) ?? { username: "user", avatar_url: null },
      }))
    );

    // mark all as read
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("notif-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const acceptReq = async (id: string, followerId: string) => {
    if (!user) return;
    await supabase.from("follows").update({ status: "accepted" }).eq("id", id);
    await supabase
      .from("notifications")
      .insert({ user_id: followerId, actor_id: user.id, type: "follow_accepted" });
    toast.success("Request accepted");
    load();
  };
  const rejectReq = async (id: string) => {
    await supabase.from("follows").delete().eq("id", id);
    load();
  };

  const onFollowBack = async (actorId: string) => {
    if (!user) return;
    try {
      const status = await followBack(user.id, actorId);
      toast.success(status === "pending" ? "Request sent" : "Following");
      setItems((prev) =>
        prev.map((n) => (n.actor_id === actorId ? { ...n, iFollowBack: status === "accepted" } : n))
      );
    } catch (e: any) {
      toast.error(e.message ?? "Could not follow");
    }
  };

  const onMessage = async (actorId: string) => {
    if (!user) return;
    const allowed = await canMessage(user.id, actorId);
    if (!allowed) {
      return toast.error("This user must follow you back to receive messages");
    }
    const [u1, u2] = [user.id, actorId].sort();
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user1_id", u1)
      .eq("user2_id", u2)
      .maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user1_id: u1, user2_id: u2 })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      convId = data.id;
    }
    nav({ to: "/messages/$id", params: { id: convId } });
  };

  const onBlock = async (actorId: string) => {
    if (!user) return;
    if (!confirm("Block this user? They won't be able to see your profile or message you.")) return;
    await blockUser(user.id, actorId);
    toast.success("User blocked");
    load();
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-4 h-14 flex items-center safe-top">
        <h1 className="text-xl font-display font-bold">Activity</h1>
      </header>

      {/* Pending follow requests (private accounts) */}
      {requests.length > 0 && (
        <section className="px-4 pt-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Follow requests · {requests.length}
          </h2>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {requests.map((r) => (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 p-3 rounded-2xl glass"
                >
                  <Link to="/u/$username" params={{ username: r.follower.username }}>
                    <Avatar
                      url={r.follower.avatar_url}
                      username={r.follower.username}
                      size={44}
                      ring
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/u/$username"
                      params={{ username: r.follower.username }}
                      className="font-semibold text-sm block truncate"
                    >
                      {r.follower.username}
                    </Link>
                    <div className="text-xs text-muted-foreground">requested to follow you</div>
                  </div>
                  <button
                    onClick={() => acceptReq(r.id, r.follower_id)}
                    className="px-3 h-9 rounded-xl bg-gradient-brand text-primary-foreground text-xs font-semibold shadow-glow"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => rejectReq(r.id)}
                    className="px-3 h-9 rounded-xl glass text-xs font-semibold"
                  >
                    Delete
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {/* Activity feed */}
      <section className="px-2 pt-3 pb-6">
        {requests.length > 0 && items.length > 0 && (
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-2">
            Earlier
          </h2>
        )}

        {loading && items.length === 0 ? (
          <div className="space-y-2 px-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 && requests.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((n) => (
              <NotifRow
                key={n.id}
                n={n}
                onFollowBack={onFollowBack}
                onMessage={onMessage}
                onBlock={onBlock}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NotifRow({
  n,
  onFollowBack,
  onMessage,
  onBlock,
}: {
  n: Notif;
  onFollowBack: (id: string) => void;
  onMessage: (id: string) => void;
  onBlock: (id: string) => void;
}) {
  const isFollow = n.type === "follow" || n.type === "follow_accepted";

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 rounded-2xl">
      <Link to="/u/$username" params={{ username: n.actor.username }}>
        <Avatar url={n.actor.avatar_url} username={n.actor.username} size={44} ring />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-tight">
          <Link
            to="/u/$username"
            params={{ username: n.actor.username }}
            className="font-semibold"
          >
            {n.actor.username}
          </Link>{" "}
          <span className="text-muted-foreground">{label(n.type)}</span>
        </div>
        <div className="text-[11px] text-muted-foreground/70 mt-0.5">{timeAgo(n.created_at)}</div>
      </div>

      {isFollow && !n.iFollowBack ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onFollowBack(n.actor_id)}
            className="px-3 h-8 rounded-lg bg-gradient-brand text-primary-foreground text-xs font-semibold shadow-glow"
          >
            Follow back
          </button>
          <button
            onClick={() => onMessage(n.actor_id)}
            aria-label="Message"
            className="w-8 h-8 grid place-items-center rounded-lg glass"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={() => onBlock(n.actor_id)}
            aria-label="Block"
            className="w-8 h-8 grid place-items-center rounded-lg glass text-destructive"
          >
            <Ban className="w-4 h-4" />
          </button>
        </div>
      ) : isFollow && n.iFollowBack ? (
        <span className="text-[11px] px-2.5 h-7 rounded-lg glass grid place-items-center text-muted-foreground">
          Following
        </span>
      ) : (
        <>
          <NotifIcon type={n.type} />
          {n.post?.image_url && (
            <Link to="/p/$id" params={{ id: n.post_id! }}>
              <img
                src={n.post.image_url}
                className="w-11 h-11 rounded-lg object-cover"
                loading="lazy"
              />
            </Link>
          )}
        </>
      )}
    </li>
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
  if (type === "like") return <Heart className="w-4 h-4 text-[oklch(0.65_0.25_25)] fill-current" />;
  if (type === "comment") return <MessageCircle className="w-4 h-4 text-muted-foreground" />;
  return <UserPlus className="w-4 h-4 text-muted-foreground" />;
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w`;
  return new Date(iso).toLocaleDateString();
}
