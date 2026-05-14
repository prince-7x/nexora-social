import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Track = {
  id: number;
  title: string;
  artist: string;
  preview: string; // 30s mp3
  cover: string;
};

export const searchTracks = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().trim().min(1).max(100) }).parse(input)
  )
  .handler(async ({ data }): Promise<Track[]> => {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(data.q)}&limit=25`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id: number;
        title: string;
        preview: string;
        artist: { name: string };
        album: { cover_medium: string };
      }>;
    };
    return (json.data ?? [])
      .filter((t) => t.preview)
      .map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist?.name ?? "Unknown",
        preview: t.preview,
        cover: t.album?.cover_medium ?? "",
      }));
  });
