import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { hydratePosts } from "@/lib/posts";
import { Logo } from "@/components/Logo";
import { Heart, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/")({
  component: FeedPage,
});

function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data: rows } = await supabase
      .from("posts")
      .select("id,user_id,image_url,caption,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    const hydrated = await hydratePosts(rows ?? [], user?.id);
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
        <div className="flex items-center justify-between px-4 h-14 safe-top">
          <Logo size="md" />
          <div className="flex items-center gap-1">
            <Link to="/notifications" className="p-2 text-muted-foreground hover:text-foreground">
              <Heart className="w-6 h-6" />
            </Link>
            <Link to="/messages" className="p-2 text-muted-foreground hover:text-foreground">
              <MessageCircle className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </header>

      <button
        onClick={onRefresh}
        className="w-full text-center text-xs text-muted-foreground py-2"
      >
        {refreshing ? "Refreshing…" : "Pull to refresh"}
      </button>

      <div className="px-3 space-y-4 pb-6">
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
        {posts?.map((p) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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
