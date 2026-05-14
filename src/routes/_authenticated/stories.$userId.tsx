import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { X, ChevronLeft, ChevronRight, Music, Eye, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type Story = {
  id: string;
  user_id: string;
  image_url: string;
  music_title: string | null;
  music_artist: string | null;
  music_preview_url: string | null;
  music_cover_url: string | null;
  close_friends_only: boolean;
  created_at: string;
};
type Author = { id: string; username: string; avatar_url: string | null };

export const Route = createFileRoute("/_authenticated/stories/$userId")({
  component: StoryViewerPage,
});

const STORY_DURATION = 5500; // ms

function StoryViewerPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<{ username: string; avatar_url: string | null }[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const isMine = user?.id === userId;

  useEffect(() => {
    (async () => {
      const [{ data: ss }, { data: prof }] = await Promise.all([
        supabase
          .from("stories")
          .select("id,user_id,image_url,music_title,music_artist,music_preview_url,music_cover_url,close_friends_only,created_at")
          .eq("user_id", userId)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("id,username,avatar_url")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      setStories((ss as Story[]) ?? []);
      setAuthor((prof as Author) ?? null);
      if (!ss || ss.length === 0) {
        toast.error("No active stories");
        nav({ to: "/" });
      }
    })();
  }, [userId, nav]);

  // Mark seen + load viewers when story changes
  useEffect(() => {
    if (!stories || !user) return;
    const s = stories[idx];
    if (!s) return;
    elapsedRef.current = 0;
    startRef.current = Date.now();
    setProgress(0);

    if (!isMine) {
      supabase.from("story_views").upsert({ story_id: s.id, viewer_id: user.id }).then(() => {});
    }
    if (isMine) {
      (async () => {
        const { data: vs } = await supabase
          .from("story_views")
          .select("viewer_id")
          .eq("story_id", s.id);
        const ids = (vs ?? []).map((v: any) => v.viewer_id).filter((id: string) => id !== user.id);
        if (ids.length) {
          const { data: ps } = await supabase
            .from("profiles")
            .select("username,avatar_url")
            .in("id", ids);
          setViewers((ps as any) ?? []);
        } else setViewers([]);
      })();
    }

    // music
    audioRef.current?.pause();
    if (s.music_preview_url) {
      const a = new Audio(s.music_preview_url);
      a.loop = true;
      a.volume = 0.7;
      a.play().catch(() => {});
      audioRef.current = a;
    } else {
      audioRef.current = null;
    }
    return () => {
      audioRef.current?.pause();
    };
  }, [idx, stories, user, isMine]);

  // Progress timer
  useEffect(() => {
    if (!stories || paused || showViewers) return;
    let raf: number;
    const tick = () => {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const p = Math.min(elapsed / STORY_DURATION, 1);
      setProgress(p);
      if (p >= 1) {
        if (idx < stories.length - 1) setIdx((i) => i + 1);
        else nav({ to: "/" });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stories, idx, paused, showViewers, nav]);

  // Pause handlers
  const onPauseStart = () => {
    elapsedRef.current += Date.now() - startRef.current;
    setPaused(true);
    audioRef.current?.pause();
  };
  const onPauseEnd = () => {
    startRef.current = Date.now();
    setPaused(false);
    audioRef.current?.play().catch(() => {});
  };

  const next = () => {
    if (!stories) return;
    if (idx < stories.length - 1) setIdx((i) => i + 1);
    else nav({ to: "/" });
  };
  const prev = () => {
    if (idx > 0) setIdx((i) => i - 1);
  };

  const deleteStory = async () => {
    if (!stories) return;
    const s = stories[idx];
    if (!confirm("Delete this story?")) return;
    await supabase.from("stories").delete().eq("id", s.id);
    toast.success("Deleted");
    nav({ to: "/" });
  };

  if (!stories || !author) return <div className="min-h-screen bg-black" />;
  const s = stories[idx];
  if (!s) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
      onPointerDown={onPauseStart}
      onPointerUp={onPauseEnd}
      onPointerLeave={onPauseEnd}
    >
      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.img
          key={s.id}
          src={s.image_url}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>

      {/* Top gradient */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

      {/* Progress bars */}
      <div className="absolute top-3 inset-x-3 flex gap-1 z-20">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-[width]"
              style={{
                width:
                  i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%",
                transitionDuration: i === idx ? "60ms" : "0ms",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-7 inset-x-3 flex items-center gap-3 z-20">
        <Avatar url={author.avatar_url} username={author.username} size={36} ring />
        <div className="flex-1">
          <div className="text-sm font-semibold text-white flex items-center gap-1.5">
            {author.username}
            {s.close_friends_only && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[oklch(0.7_0.2_150)]/20 text-[oklch(0.85_0.2_150)]">
                Close friends
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/60">{timeAgo(s.created_at)}</div>
        </div>
        {isMine && (
          <button onClick={deleteStory} className="p-2 text-white/80" aria-label="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => nav({ to: "/" })} className="p-2 text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Music chip */}
      {s.music_title && (
        <div className="absolute top-20 left-3 max-w-[70%] flex items-center gap-2 glass-strong rounded-full pl-1 pr-3 h-8 z-20">
          {s.music_cover_url ? (
            <img src={s.music_cover_url} className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <Music className="w-4 h-4 ml-1 text-white" />
          )}
          <span className="text-[11px] text-white truncate">
            {s.music_title} · {s.music_artist}
          </span>
        </div>
      )}

      {/* Tap zones */}
      <button
        className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
        onClick={(e) => { e.stopPropagation(); prev(); }}
        aria-label="Previous"
      />
      <button
        className="absolute right-0 top-0 bottom-0 w-2/3 z-10"
        onClick={(e) => { e.stopPropagation(); next(); }}
        aria-label="Next"
      />

      {/* Viewers (own stories) */}
      {isMine && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowViewers(true); onPauseStart(); }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 h-10 rounded-full glass-strong text-white text-sm z-20"
        >
          <Eye className="w-4 h-4" /> {viewers.length} {viewers.length === 1 ? "view" : "views"}
        </button>
      )}

      <AnimatePresence>
        {showViewers && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30 }}
            className="absolute inset-x-0 bottom-0 max-h-[60%] glass-strong rounded-t-3xl border-t border-white/10 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between">
              <h3 className="font-display font-bold">Viewers · {viewers.length}</h3>
              <button onClick={() => { setShowViewers(false); onPauseEnd(); }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="px-3 pb-6 overflow-y-auto max-h-[50vh]">
              {viewers.length === 0 && (
                <li className="text-center text-sm text-muted-foreground py-8">No views yet</li>
              )}
              {viewers.map((v) => (
                <li key={v.username} className="flex items-center gap-3 py-2.5">
                  <Avatar url={v.avatar_url} username={v.username} size={36} ring />
                  <span className="text-sm font-semibold">{v.username}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
