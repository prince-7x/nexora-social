import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/Avatar";

type Post = { id: string; image_url: string };
type ProfileRow = { id: string; username: string; full_name: string; avatar_url: string | null; is_verified: boolean };

export const Route = createFileRoute("/_authenticated/explore")({
  component: ExplorePage,
});

function ExplorePage() {
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [results, setResults] = useState<ProfileRow[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    supabase
      .from("posts")
      .select("id,image_url")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => setPosts(data ?? []));
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 1) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,is_verified")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-4 py-3 safe-top">
        <div className="flex items-center gap-3 px-4 h-11 rounded-full glass">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </header>

      {q.trim().length > 0 ? (
        <div className="px-2 py-3 space-y-1">
          {results.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">No matches</div>
          )}
          {results.map((p) => (
            <Link
              key={p.id}
              to="/u/$username"
              params={{ username: p.username }}
              className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-muted/40 transition"
            >
              <Avatar url={p.avatar_url} username={p.username} size={44} ring />
              <div>
                <div className="font-semibold text-sm">{p.username}</div>
                <div className="text-xs text-muted-foreground">{p.full_name}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 p-1">
          {posts.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              onClick={() => nav({ to: "/p/$id", params: { id: p.id } })}
              className="aspect-square overflow-hidden bg-muted relative group"
            >
              <img src={p.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
