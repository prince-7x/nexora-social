import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { BadgeCheck, Settings, Lock, Grid3x3, Bookmark, Ban, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { canMessage, blockUser, unblockUser, isBlocked } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: ProfilePage,
});

type ProfileFull = {
  id: string; username: string; full_name: string; bio: string;
  avatar_url: string | null; is_private: boolean; is_verified: boolean;
};

function ProfilePage() {
  const { username } = Route.useParams();
  const { user, profile: me } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<ProfileFull | null>(null);
  const [posts, setPosts] = useState<{ id: string; image_url: string }[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0, posts: 0 });
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted">("none");
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [canDM, setCanDM] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const isMe = me?.username === username;

  const load = async () => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,username,full_name,bio,avatar_url,is_private,is_verified")
      .ilike("username", username)
      .maybeSingle();
    if (!prof) return;
    setP(prof);
    const [{ data: ps }, { count: f1 }, { count: f2 }, { count: pc }, follow] = await Promise.all([
      supabase.from("posts").select("id,image_url").eq("user_id", prof.id).order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", prof.id).eq("status", "accepted"),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", prof.id).eq("status", "accepted"),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", prof.id),
      user ? supabase.from("follows").select("status").eq("follower_id", user.id).eq("following_id", prof.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setPosts(ps ?? []);
    setCounts({ followers: f1 ?? 0, following: f2 ?? 0, posts: pc ?? 0 });
    setFollowStatus((follow?.data?.status as any) ?? "none");
    if (user && user.id !== prof.id) {
      const [dm, bk] = await Promise.all([
        canMessage(user.id, prof.id),
        isBlocked(user.id, prof.id),
      ]);
      setCanDM(dm);
      setBlocked(bk);
    }
  };

  useEffect(() => { load(); }, [username, user?.id]);

  const toggleFollow = async () => {
    if (!user || !p) return;
    if (followStatus === "none") {
      const status = p.is_private ? "pending" : "accepted";
      await supabase.from("follows").insert({ follower_id: user.id, following_id: p.id, status });
      await supabase.from("notifications").insert({ user_id: p.id, actor_id: user.id, type: status === "pending" ? "follow_request" : "follow" });
      setFollowStatus(status);
    } else {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", p.id);
      setFollowStatus("none");
    }
    load();
  };

  const message = async () => {
    if (!user || !p) return;
    const [u1, u2] = [user.id, p.id].sort();
    const { data: existing } = await supabase
      .from("conversations").select("id").eq("user1_id", u1).eq("user2_id", u2).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data, error } = await supabase.from("conversations").insert({ user1_id: u1, user2_id: u2 }).select("id").single();
      if (error) return toast.error(error.message);
      convId = data.id;
    }
    nav({ to: "/messages/$id", params: { id: convId } });
  };

  if (!p) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  const canSeePosts = !p.is_private || isMe || followStatus === "accepted";

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-4 h-14 flex items-center justify-between safe-top">
        <div className="flex items-center gap-1">
          <span className="font-semibold">{p.username}</span>
          {p.is_verified && <BadgeCheck className="w-4 h-4 text-[oklch(0.7_0.18_220)]" />}
          {p.is_private && <Lock className="w-3.5 h-3.5 text-muted-foreground ml-1" />}
        </div>
        {isMe && (
          <Link to="/settings" className="p-2 -mr-2"><Settings className="w-5 h-5" /></Link>
        )}
      </header>

      <div className="px-4 py-5">
        <div className="flex items-center gap-5">
          <Avatar url={p.avatar_url} username={p.username} size={88} ring />
          <div className="flex-1 grid grid-cols-3 text-center">
            <Stat n={counts.posts} label="posts" />
            <Stat n={counts.followers} label="followers" />
            <Stat n={counts.following} label="following" />
          </div>
        </div>
        <div className="mt-4">
          <div className="font-semibold">{p.full_name}</div>
          {p.bio && <div className="text-sm text-foreground/85 whitespace-pre-wrap">{p.bio}</div>}
        </div>

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <Link to="/edit-profile" className="flex-1 h-10 rounded-xl glass font-semibold text-sm grid place-items-center">Edit profile</Link>
          ) : (
            <>
              <button
                onClick={toggleFollow}
                className={`flex-1 h-10 rounded-xl font-semibold text-sm ${followStatus === "none" ? "bg-gradient-brand text-primary-foreground shadow-glow" : "glass"}`}
              >
                {followStatus === "accepted" ? "Following" : followStatus === "pending" ? "Requested" : "Follow"}
              </button>
              <button onClick={message} className="flex-1 h-10 rounded-xl glass font-semibold text-sm">Message</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 border-y border-border">
        <button onClick={() => setTab("posts")} className={`h-11 flex items-center justify-center gap-2 text-sm ${tab === "posts" ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground"}`}>
          <Grid3x3 className="w-4 h-4" /> Posts
        </button>
        {isMe && (
          <button onClick={() => setTab("saved")} className={`h-11 flex items-center justify-center gap-2 text-sm ${tab === "saved" ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground"}`}>
            <Bookmark className="w-4 h-4" /> Saved
          </button>
        )}
      </div>

      {tab === "posts" && (
        canSeePosts ? (
          <div className="grid grid-cols-3 gap-1 p-1">
            {posts.map((post, i) => (
              <motion.div key={post.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                <Link to="/p/$id" params={{ id: post.id }} className="block aspect-square overflow-hidden bg-muted">
                  <img src={post.image_url} className="w-full h-full object-cover" loading="lazy" />
                </Link>
              </motion.div>
            ))}
            {posts.length === 0 && <div className="col-span-3 text-center py-12 text-sm text-muted-foreground">No posts yet</div>}
          </div>
        ) : (
          <div className="text-center py-16 px-6">
            <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">This account is private. Follow to see their posts.</p>
          </div>
        )
      )}
      {tab === "saved" && isMe && <SavedGrid />}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-bold">{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SavedGrid() {
  const { user } = useAuth();
  const [items, setItems] = useState<{ id: string; image_url: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: bks } = await supabase.from("bookmarks").select("post_id").eq("user_id", user.id);
      const ids = (bks ?? []).map((b) => b.post_id);
      if (!ids.length) return setItems([]);
      const { data: ps } = await supabase.from("posts").select("id,image_url").in("id", ids);
      setItems(ps ?? []);
    })();
  }, [user?.id]);
  return (
    <div className="grid grid-cols-3 gap-1 p-1">
      {items.map((p) => (
        <Link key={p.id} to="/p/$id" params={{ id: p.id }} className="aspect-square overflow-hidden bg-muted">
          <img src={p.image_url} className="w-full h-full object-cover" loading="lazy" />
        </Link>
      ))}
      {items.length === 0 && <div className="col-span-3 text-center py-12 text-sm text-muted-foreground">Nothing saved</div>}
    </div>
  );
}
