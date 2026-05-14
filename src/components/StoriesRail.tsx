import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { Plus } from "lucide-react";

type StoryRow = {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
};
type Bucket = {
  user: { id: string; username: string; avatar_url: string | null; full_name: string };
  hasUnseen: boolean;
  count: number;
};

export function StoriesRail() {
  const { user, profile } = useAuth();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [myActive, setMyActive] = useState(false);

  const load = async () => {
    if (!user) return;
    // Active stories (RLS already filters expired + visibility)
    const { data: stories } = await supabase
      .from("stories")
      .select("id,user_id,image_url,created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const rows = (stories ?? []) as StoryRow[];
    if (!rows.length) {
      setBuckets([]);
      setMyActive(false);
      return;
    }

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    setMyActive(userIds.includes(user.id));

    const [{ data: profs }, { data: views }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .in("id", userIds),
      supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", user.id)
        .in(
          "story_id",
          rows.map((r) => r.id)
        ),
    ]);
    const seen = new Set((views ?? []).map((v: any) => v.story_id));
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

    const grouped = new Map<string, Bucket>();
    rows.forEach((r) => {
      const u = profMap.get(r.user_id);
      if (!u) return;
      let b = grouped.get(r.user_id);
      if (!b) {
        b = { user: u as any, hasUnseen: false, count: 0 };
        grouped.set(r.user_id, b);
      }
      b.count++;
      if (!seen.has(r.id) && r.user_id !== user.id) b.hasUnseen = true;
    });

    // Order: me first, then unseen, then seen
    const list = Array.from(grouped.values()).sort((a, b) => {
      if (a.user.id === user.id) return -1;
      if (b.user.id === user.id) return 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return 0;
    });
    setBuckets(list);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("stories-rail")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <section className="border-b border-border/60">
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 py-4">
        {/* Your story tile */}
        <Link
          to={myActive ? "/stories/$userId" : "/stories/new"}
          params={myActive ? { userId: user!.id } : undefined as any}
          className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
        >
          <div className="relative">
            {myActive ? (
              <div className="p-[2px] rounded-full bg-gradient-brand">
                <div className="p-[2px] rounded-full bg-background">
                  <Avatar url={profile?.avatar_url} username={profile?.username} size={58} />
                </div>
              </div>
            ) : (
              <div className="w-[64px] h-[64px] rounded-full bg-muted/60 grid place-items-center border border-border">
                <Avatar url={profile?.avatar_url} username={profile?.username} size={56} />
              </div>
            )}
            <Link
              to="/stories/new"
              className="absolute -bottom-0.5 -right-0.5 grid place-items-center w-5 h-5 rounded-full bg-gradient-brand ring-2 ring-background"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
            </Link>
          </div>
          <span className="text-[11px] text-muted-foreground truncate w-full text-center">
            Your story
          </span>
        </Link>

        {buckets
          .filter((b) => b.user.id !== user?.id)
          .map((b) => (
            <Link
              key={b.user.id}
              to="/stories/$userId"
              params={{ userId: b.user.id }}
              className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
            >
              <div
                className={`p-[2px] rounded-full ${
                  b.hasUnseen ? "bg-gradient-brand" : "bg-muted"
                }`}
              >
                <div className="p-[2px] rounded-full bg-background">
                  <Avatar url={b.user.avatar_url} username={b.user.username} size={58} />
                </div>
              </div>
              <span className="text-[11px] text-foreground/80 truncate w-full text-center">
                {b.user.full_name?.split(" ")[0] || b.user.username}
              </span>
            </Link>
          ))}

        {buckets.length <= (myActive ? 1 : 0) && (
          <div className="flex items-center text-xs text-muted-foreground/70 px-2">
            No stories yet — be the first ✨
          </div>
        )}
      </div>
    </section>
  );
}
