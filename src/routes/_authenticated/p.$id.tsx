import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { hydratePosts } from "@/lib/posts";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

type Comment = { id: string; user_id: string; content: string; created_at: string; author: { username: string; avatar_url: string | null } };

export const Route = createFileRoute("/_authenticated/p/$id")({
  component: PostDetailPage,
});

function PostDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");

  const load = async () => {
    const { data: row } = await supabase
      .from("posts").select("id,user_id,image_url,caption,created_at").eq("id", id).maybeSingle();
    if (!row) return;
    const [p] = await hydratePosts([row], user?.id);
    setPost(p);
    const { data: c } = await supabase
      .from("comments").select("id,user_id,content,created_at").eq("post_id", id).order("created_at");
    const ids = Array.from(new Set((c ?? []).map((x) => x.user_id)));
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids) : { data: [] };
    const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setComments((c ?? []).map((x) => ({ ...x, author: m.get(x.user_id) ?? { username: "user", avatar_url: null } })));
  };
  useEffect(() => { load(); }, [id, user?.id]);

  const addComment = async () => {
    if (!user || !text.trim() || !post) return;
    const content = text.trim().slice(0, 500);
    setText("");
    await supabase.from("comments").insert({ post_id: id, user_id: user.id, content });
    if (post.user_id !== user.id) {
      await supabase.from("notifications").insert({ user_id: post.user_id, actor_id: user.id, type: "comment", post_id: id });
    }
    load();
  };

  const deletePost = async () => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("posts").delete().eq("id", id);
    toast.success("Deleted");
    nav({ to: "/" });
  };

  if (!post) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center justify-between safe-top">
        <Link to="/" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-semibold">Post</h1>
        {post.user_id === user?.id ? (
          <button onClick={deletePost} className="p-2 -mr-1 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-5 h-5" />
          </button>
        ) : <div className="w-9" />}
      </header>

      <div className="px-3 py-3">
        <PostCard post={post} />
      </div>

      <div className="px-4 mt-2 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Comments</h2>
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Be the first to comment.</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar url={c.author.avatar_url} username={c.author.username} size={32} />
            <div className="flex-1 text-sm">
              <Link to="/u/$username" params={{ username: c.author.username }} className="font-semibold mr-2">{c.author.username}</Link>
              <span>{c.content}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-16 inset-x-0 z-30 px-3 pb-2 safe-bottom">
        <div className="mx-auto max-w-md flex items-center gap-2 px-3 h-12 rounded-full glass-strong">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addComment()}
            placeholder="Add a comment…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={addComment} disabled={!text.trim()} className="p-2 text-primary disabled:opacity-40">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
