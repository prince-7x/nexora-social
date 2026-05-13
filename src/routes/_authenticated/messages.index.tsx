import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, MessageCircle } from "lucide-react";

type ConvRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  last_message_at: string;
};
type ConvUI = ConvRow & { other: { id: string; username: string; avatar_url: string | null; is_verified: boolean; last_seen: string } };

export const Route = createFileRoute("/_authenticated/messages/")({
  component: MessagesIndex,
});

function MessagesIndex() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvUI[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("id,user1_id,user2_id,last_message,last_message_at")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    const rows = (data ?? []) as ConvRow[];
    const otherIds = rows.map((c) => (c.user1_id === user.id ? c.user2_id : c.user1_id));
    const { data: profs } = otherIds.length
      ? await supabase.from("profiles").select("id,username,avatar_url,is_verified,last_seen").in("id", otherIds)
      : { data: [] };
    const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setConvs(
      rows.map((c) => {
        const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
        return { ...c, other: m.get(otherId) ?? { id: otherId, username: "user", avatar_url: null, is_verified: false, last_seen: new Date().toISOString() } };
      })
    );
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-4 h-14 flex items-center justify-between safe-top">
        <Link to="/" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display font-bold">Messages</h1>
        <div className="w-9" />
      </header>

      {convs.length === 0 ? (
        <div className="text-center py-20 px-6">
          <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-bold">No conversations yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Find someone to chat with from Explore.</p>
        </div>
      ) : (
        <ul className="px-2 py-2">
          {convs.map((c) => {
            const online = Date.now() - new Date(c.other.last_seen).getTime() < 60000;
            return (
              <li key={c.id}>
                <Link
                  to="/messages/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted/40 transition"
                >
                  <div className="relative">
                    <Avatar url={c.other.avatar_url} username={c.other.username} size={52} ring />
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[oklch(0.7_0.2_150)] border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{c.other.username}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.last_message || "Say hi 👋"}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
