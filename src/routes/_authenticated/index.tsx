import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { hydratePosts } from "@/lib/posts";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { MessageSquare, Users, Plus } from "lucide-react";
import { motion } from "framer-motion";
import type { Profile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/")({
  component: FeedPage,
});

type FriendStub = Pick<Profile, "id" | "username" | "avatar_url" | "full_name">;

function FeedPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [friends, setFriends] = useState<FriendStub[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    // Following ids — for stories rail + feed priority
    let followingIds: string[] = [];
    if (user?.id) {
      const { data: f } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .eq("status", "accepted");
      followingIds = (f ?? []).map((r: any) => r.following_id);
    }

    if (followingIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .in("id", followingIds)
        .order("last_seen", { ascending: false })
        .limit(20);
      setFriends((profs as FriendStub[]) ?? []);
    } else {
      setFriends([]);
    }

    const { data: rows } = await supabase
      .from("posts")
      .select("id,user_id,image_url,caption,created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    // Prioritize friends' posts at the top, public posts after
    const sorted = (rows ?? []).slice().sort((a: any, b: any) => {
      const af = followingIds.includes(a.user_id) ? 0 : 1;
      const bf = followingIds.includes(b.user_id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const hydrated = await hydratePosts(sorted, user?.id);
    setPosts(hydrated);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="flex items-center justify-between px-5 h-14 safe-top">
          <Logo size="md" />
          <div className="flex items-center gap-2">
            <Link
              to="/messages"
              className="p-2 rounded-full text-foreground/90 hover:text-foreground hover:bg-white/5 transition"
              aria-label="Messages"
            >
              <MessageSquare className="w-[22px] h-[22px]" strokeWidth={1.8} />
            </Link>
            <Link
              to="/notifications"
              className="p-2 rounded-full text-foreground/90 hover:text-foreground hover:bg-white/5 transition"
              aria-label="Friends activity"
            >
              <Users className="w-[22px] h-[22px]" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </header>

      {/* Stories / friends rail */}
      <section className="border-b border-border/60">
        <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 py-4">
          {/* Your story */}
          <Link
            to="/create"
            className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
          >
            <div className="relative w-[64px] h-[64px] rounded-full bg-muted/60 grid place-items-center border border-border">
              <Avatar
                url={profile?.avatar_url}
                username={profile?.username}
                size={56}
              />
              <span className="absolute bottom-0 right-0 grid place-items-center w-5 h-5 rounded-full bg-gradient-brand ring-2 ring-background">
                <Plus className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate w-full text-center">Your story</span>
          </Link>

          {friends.length === 0 && posts !== null && (
            <div className="flex items-center text-xs text-muted-foreground/70 px-2">
              Follow people to see their stories here
            </div>
          )}

          {friends.map((f) => (
            <Link
              key={f.id}
              to="/u/$username"
              params={{ username: f.username }}
              className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
            >
              <div className="p-[2px] rounded-full bg-gradient-brand">
                <div className="p-[2px] rounded-full bg-background">
                  <Avatar url={f.avatar_url} username={f.username} size={58} />
                </div>
              </div>
              <span className="text-[11px] text-foreground/80 truncate w-full text-center">
                {f.full_name?.split(" ")[0] || f.username}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <button
        onClick={onRefresh}
        className="w-full text-center text-[11px] text-muted-foreground/70 py-1.5 hover:text-foreground transition"
      >
        {refreshing ? "Refreshing…" : "Pull to refresh"}
      </button>

      <div className="px-3 space-y-5 pb-8">
        {posts === null && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        {posts && posts.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="text-5xl">✨</div>
            <h2 className="mt-4 font-display text-xl font-bold">Your feed is empty</h2>
            <p className="mt-2 text-sm text-muted-foreground">Follow people or create your first post.</p>
            <Link
              to="/explore"
              className="mt-6 inline-block px-5 py-2.5 rounded-full bg-gradient-brand font-semibold text-primary-foreground shadow-glow"
            >
              Discover people
            </Link>
          </motion.div>
        )}
        {posts?.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
          >
            <PostCard post={p} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl glass overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full skeleton" />
        <div className="h-3 w-24 rounded skeleton" />
      </div>
      <div className="aspect-square skeleton" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-1/3 skeleton rounded" />
        <div className="h-3 w-2/3 skeleton rounded" />
      </div>
    </div>
  );
}
