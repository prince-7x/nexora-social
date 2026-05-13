import { useEffect, useState } from "react";
import { Heart, MessageCircle, Bookmark, Send, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProfileChip } from "./Avatar";
import { toast } from "sonner";
import type { Profile } from "@/lib/auth";

export type FeedPost = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  author: Pick<Profile, "username" | "avatar_url" | "is_verified" | "full_name">;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
};

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(d).toLocaleDateString();
}

export function PostCard({ post: initial }: { post: FeedPost }) {
  const { user } = useAuth();
  const [post, setPost] = useState(initial);
  const [showHeart, setShowHeart] = useState(false);

  useEffect(() => setPost(initial), [initial]);

  const toggleLike = async () => {
    if (!user) return;
    const next = !post.liked_by_me;
    setPost((p) => ({ ...p, liked_by_me: next, like_count: p.like_count + (next ? 1 : -1) }));
    if (next) {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: user.id,
          type: "like",
          post_id: post.id,
        });
      }
    } else {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    }
  };

  const toggleSave = async () => {
    if (!user) return;
    const next = !post.saved_by_me;
    setPost((p) => ({ ...p, saved_by_me: next }));
    if (next) {
      await supabase.from("bookmarks").insert({ post_id: post.id, user_id: user.id });
      toast.success("Saved");
    } else {
      await supabase.from("bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id);
    }
  };

  const onDoubleClick = () => {
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    if (!post.liked_by_me) toggleLike();
  };

  return (
    <article className="rounded-3xl glass overflow-hidden shadow-card border border-white/5">
      <header className="flex items-center justify-between px-4 py-3">
        <ProfileChip profile={post.author} ring subtitle={timeAgo(post.created_at)} />
        <button className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      <div
        className="relative w-full aspect-square bg-muted overflow-hidden"
        onDoubleClick={onDoubleClick}
      >
        <img src={post.image_url} alt={post.caption} className="w-full h-full object-cover" loading="lazy" />
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart className="w-32 h-32 fill-white text-white drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-1">
          <motion.button whileTap={{ scale: 0.85 }} onClick={toggleLike} className="p-1.5 -ml-1.5">
            <Heart
              className={`w-7 h-7 transition ${post.liked_by_me ? "fill-[oklch(0.65_0.25_25)] text-[oklch(0.65_0.25_25)]" : ""}`}
              strokeWidth={1.8}
            />
          </motion.button>
          <Link to="/p/$id" params={{ id: post.id }} className="p-1.5">
            <MessageCircle className="w-7 h-7" strokeWidth={1.8} />
          </Link>
          <button className="p-1.5">
            <Send className="w-7 h-7" strokeWidth={1.8} />
          </button>
          <motion.button whileTap={{ scale: 0.85 }} onClick={toggleSave} className="ml-auto p-1.5 -mr-1.5">
            <Bookmark
              className={`w-7 h-7 transition ${post.saved_by_me ? "fill-foreground" : ""}`}
              strokeWidth={1.8}
            />
          </motion.button>
        </div>

        {post.like_count > 0 && (
          <div className="text-sm font-semibold">
            {post.like_count.toLocaleString()} {post.like_count === 1 ? "like" : "likes"}
          </div>
        )}

        {post.caption && (
          <p className="text-sm">
            <Link to="/u/$username" params={{ username: post.author.username }} className="font-semibold mr-2">
              {post.author.username}
            </Link>
            <span className="text-foreground/90">{post.caption}</span>
          </p>
        )}

        {post.comment_count > 0 && (
          <Link
            to="/p/$id"
            params={{ id: post.id }}
            className="text-sm text-muted-foreground block"
          >
            View all {post.comment_count} comments
          </Link>
        )}
      </div>
    </article>
  );
}
