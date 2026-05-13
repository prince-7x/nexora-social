import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadFile } from "@/lib/upload";
import { ImagePlus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
});

function CreatePage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const onPick = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !user) return;
    if (caption.length > 2000) return toast.error("Caption too long");
    setLoading(true);
    try {
      const url = await uploadFile("posts", user.id, file);
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: url,
        caption: caption.trim(),
      });
      if (error) throw error;
      toast.success("Posted");
      nav({ to: "/" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl font-display font-bold mb-4">New post</h1>

      {!preview ? (
        <label className="block aspect-square rounded-3xl glass border-dashed border-2 border-border grid place-items-center cursor-pointer hover:border-primary/40 transition">
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
          <div className="text-center">
            <ImagePlus className="w-10 h-10 mx-auto text-muted-foreground" />
            <div className="mt-2 text-sm font-semibold">Choose an image</div>
            <div className="text-xs text-muted-foreground">JPG, PNG or WebP</div>
          </div>
        </label>
      ) : (
        <div className="space-y-3">
          <div className="aspect-square rounded-3xl overflow-hidden bg-muted">
            <img src={preview} className="w-full h-full object-cover" />
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            rows={3}
            className="w-full p-4 rounded-2xl glass outline-none text-sm placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="flex-1 h-12 rounded-2xl glass font-semibold text-sm"
            >
              Choose another
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex-1 h-12 rounded-2xl bg-gradient-brand font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Posting…" : <>Share <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
