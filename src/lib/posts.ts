import { supabase } from "@/integrations/supabase/client";
import type { FeedPost } from "@/components/PostCard";

type RawPost = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
};

export async function hydratePosts(rows: RawPost[], viewerId?: string | null): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const [{ data: authors }, { data: likes }, { data: comments }, mineLikes, mineSaves] = await Promise.all([
    supabase.from("profiles").select("id,username,avatar_url,is_verified,full_name").in("id", userIds),
    supabase.from("likes").select("post_id").in("post_id", ids),
    supabase.from("comments").select("post_id").in("post_id", ids),
    viewerId
      ? supabase.from("likes").select("post_id").in("post_id", ids).eq("user_id", viewerId)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    viewerId
      ? supabase.from("bookmarks").select("post_id").in("post_id", ids).eq("user_id", viewerId)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));
  const likeCounts = new Map<string, number>();
  (likes ?? []).forEach((l) => likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1));
  const commentCounts = new Map<string, number>();
  (comments ?? []).forEach((c) => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1));
  const liked = new Set((mineLikes.data ?? []).map((x) => x.post_id));
  const saved = new Set((mineSaves.data ?? []).map((x) => x.post_id));

  return rows.map((p) => ({
    ...p,
    author: authorMap.get(p.user_id) ?? { username: "unknown", avatar_url: null, is_verified: false, full_name: "" },
    like_count: likeCounts.get(p.id) ?? 0,
    comment_count: commentCounts.get(p.id) ?? 0,
    liked_by_me: liked.has(p.id),
    saved_by_me: saved.has(p.id),
  }));
}
