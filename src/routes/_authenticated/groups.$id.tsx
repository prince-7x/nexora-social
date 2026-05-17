import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Send, Settings2, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Msg = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
};
type Group = { id: string; name: string; avatar_url: string | null };
type Prof = { id: string; username: string; avatar_url: string | null };

export const Route = createFileRoute("/_authenticated/groups/$id")({
  component: GroupChat,
});

function GroupChat() {
  const { user } = useAuth();
  const { id } = useParams({ from: "/_authenticated/groups/$id" });
  const [group, setGroup] = useState<Group | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profs, setProfs] = useState<Record<string, Prof>>({});
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    const [{ data: g }, { data: m }, { data: members }] = await Promise.all([
      supabase.from("groups" as any).select("id,name,avatar_url").eq("id", id).maybeSingle(),
      supabase.from("group_messages" as any).select("*").eq("group_id", id).order("created_at").limit(200),
      supabase.from("group_members" as any).select("user_id").eq("group_id", id).eq("status", "approved"),
    ]);
    setGroup((g as unknown) as Group);
    setMsgs(((m ?? []) as unknown) as Msg[]);
    const ids = ((members ?? []) as any[]).map((x) => x.user_id);
    setCount(ids.length);
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id,username,avatar_url").in("id", ids);
      const map: Record<string, Prof> = {};
      (p ?? []).forEach((x: any) => { map[x.id] = x; });
      setProfs(map);
    }
  };

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel(`group-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` },
        (p) => setMsgs((cur) => [...cur, p.new as Msg]),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    if (!user || !text.trim()) return;
    const c = text.trim();
    setText("");
    await supabase.from("group_messages" as any).insert({
      group_id: id, sender_id: user.id, content: c,
    });
  };

  const items = useMemo(() => msgs, [msgs]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center gap-2 safe-top">
        <Link to="/groups" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-brand">
          <div className="w-full h-full rounded-full bg-background grid place-items-center overflow-hidden">
            {group?.avatar_url ? (
              <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <Users className="w-4 h-4 text-primary" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm truncate">{group?.name || "Group"}</div>
          <div className="text-[11px] text-muted-foreground">{count} members</div>
        </div>
        <Link to="/groups/$id/members" params={{ id }} className="p-2 -mr-1"><Settings2 className="w-5 h-5" /></Link>
      </header>

      <div className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((m) => {
            const mine = m.sender_id === user?.id;
            const p = profs[m.sender_id];
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
              >
                {!mine && <Avatar url={p?.avatar_url ?? null} username={p?.username ?? "u"} size={28} />}
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? "bg-gradient-brand text-primary-foreground rounded-br-sm shadow-glow"
                    : "bg-white/5 border border-white/10 rounded-bl-sm"
                }`}>
                  {!mine && <div className="text-[10px] font-bold opacity-70 mb-0.5">{p?.username || "user"}</div>}
                  {m.deleted_at ? <span className="italic opacity-60">Message unsent</span> : m.content}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 glass-strong p-3 safe-bottom border-t border-white/5">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button onClick={send} className="w-11 h-11 rounded-full bg-gradient-brand grid place-items-center shadow-glow">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
