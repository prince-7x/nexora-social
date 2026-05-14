import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/upload";
import { searchTracks, type Track } from "@/lib/music.functions";
import { ArrowLeft, ImagePlus, Music, Lock, X, Play, Pause, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/stories/new")({
  component: NewStoryPage,
});

function NewStoryPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const search = useServerFn(searchTracks);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [closeOnly, setCloseOnly] = useState(false);
  const [music, setMusic] = useState<Track | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const onFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const post = async () => {
    if (!user || !file) return toast.error("Pick a photo");
    setPosting(true);
    try {
      const url = await uploadFile("stories", user.id, file);
      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        image_url: url,
        close_friends_only: closeOnly,
        music_title: music?.title ?? null,
        music_artist: music?.artist ?? null,
        music_preview_url: music?.preview ?? null,
        music_cover_url: music?.cover ?? null,
      });
      if (error) throw error;
      toast.success("Story posted");
      nav({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center justify-between safe-top">
        <Link to="/" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display font-bold">New story</h1>
        <button
          onClick={post}
          disabled={!file || posting}
          className="px-4 h-9 rounded-xl bg-gradient-brand text-primary-foreground text-sm font-semibold shadow-glow disabled:opacity-50"
        >
          {posting ? "…" : "Share"}
        </button>
      </header>

      <div className="p-4 space-y-4">
        {/* Image */}
        {preview ? (
          <div className="relative aspect-[9/16] rounded-3xl overflow-hidden bg-muted">
            <img src={preview} className="w-full h-full object-cover" />
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full glass-strong"
            >
              <X className="w-4 h-4" />
            </button>
            {music && (
              <div className="absolute bottom-3 left-3 right-3 glass-strong rounded-full px-3 h-11 flex items-center gap-2">
                {music.cover && <img src={music.cover} className="w-7 h-7 rounded-md object-cover" />}
                <div className="flex-1 min-w-0 text-xs">
                  <div className="font-semibold truncate">{music.title}</div>
                  <div className="text-muted-foreground truncate">{music.artist}</div>
                </div>
                <button onClick={() => setMusic(null)} className="p-1.5"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ) : (
          <label className="aspect-[9/16] rounded-3xl border-2 border-dashed border-border grid place-items-center cursor-pointer glass">
            <div className="text-center">
              <ImagePlus className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Tap to choose a photo</p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMusicOpen(true)}
            className="h-12 rounded-2xl glass flex items-center justify-center gap-2 font-semibold text-sm"
          >
            <Music className="w-4 h-4" /> {music ? "Change music" : "Add music"}
          </button>
          <button
            onClick={() => setCloseOnly((v) => !v)}
            className={`h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition ${
              closeOnly ? "bg-gradient-brand text-primary-foreground shadow-glow" : "glass"
            }`}
          >
            <Lock className="w-4 h-4" /> {closeOnly ? "Close friends" : "Everyone"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {musicOpen && (
          <MusicPicker
            search={search}
            onClose={() => setMusicOpen(false)}
            onPick={(t) => { setMusic(t); setMusicOpen(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MusicPicker({
  search,
  onClose,
  onPick,
}: {
  search: ReturnType<typeof useServerFn<typeof searchTracks>>;
  onClose: () => void;
  onPick: (t: Track) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search({ data: { q } });
        setResults(r);
      } catch {
        toast.error("Music search failed");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const toggle = (t: Track) => {
    if (playing === t.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(t.preview);
    a.play().catch(() => {});
    a.onended = () => setPlaying(null);
    audioRef.current = a;
    setPlaying(t.id);
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 top-16 z-50 glass-strong rounded-t-3xl border-t border-white/10 overflow-hidden flex flex-col"
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 -ml-2"><X className="w-5 h-5" /></button>
          <h3 className="font-display font-bold text-lg">Add music</h3>
        </div>
        <div className="mt-3 flex items-center gap-2 px-3 h-11 rounded-2xl glass">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search song or artist"
            className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {results.length === 0 && !loading && (
          <li className="text-center py-12 text-sm text-muted-foreground">
            {q ? "No results" : "Try searching for a song"}
          </li>
        )}
        {results.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5"
          >
            <button onClick={() => toggle(t)} className="relative shrink-0">
              {t.cover ? (
                <img src={t.cover} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100">
                {playing === t.id ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
              </span>
              {playing === t.id && (
                <span className="absolute inset-0 grid place-items-center bg-black/50 rounded-lg">
                  <Pause className="w-4 h-4 text-white" />
                </span>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{t.title}</div>
              <div className="text-xs text-muted-foreground truncate">{t.artist}</div>
            </div>
            <button
              onClick={() => onPick(t)}
              className="px-3 h-8 rounded-lg bg-gradient-brand text-primary-foreground text-xs font-semibold"
            >
              Use
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
