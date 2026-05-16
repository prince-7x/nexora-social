import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, BadgeCheck, Image as ImageIcon, Send, Trash2, X, Reply, Pencil, Copy, CornerUpLeft } from "lucide-react";
import { uploadFile } from "@/lib/upload";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Msg = {
  id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  seen: boolean;
  created_at: string;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
};

type Reaction = { message_id: string; user_id: string; emoji: EmojiKey };

const EMOJIS: { key: EmojiKey; char: string }[] = [
  { key: "heart", char: "❤️" },
  { key: "fire", char: "🔥" },
  { key: "laugh", char: "😂" },
  { key: "like", char: "👍" },
  { key: "sad", char: "😢" },
  { key: "angry", char: "😡" },
];
type EmojiKey = "heart" | "fire" | "laugh" | "like" | "sad" | "angry";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  component: ChatPage,
});

function fmtTime(d: string) {
  const dt = new Date(d);
  return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function seenLabel(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "Seen just now";
  if (diff < 3600) return `Seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Seen ${Math.floor(diff / 3600)}h ago`;
  return `Seen ${new Date(d).toLocaleDateString()}`;
}

function ChatPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [other, setOther] = useState<{ id: string; username: string; avatar_url: string | null; last_seen: string; is_verified: boolean } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState<Msg | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lookup map for reply previews
  const msgMap = useMemo(() => {
    const m = new Map<string, Msg>();
    messages.forEach((x) => m.set(x.id, x));
    return m;
  }, [messages]);

  const reactionsByMsg = useMemo(() => {
    const m = new Map<string, Reaction[]>();
    reactions.forEach((r) => {
      const arr = m.get(r.message_id) ?? [];
      arr.push(r);
      m.set(r.message_id, arr);
    });
    return m;
  }, [reactions]);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("user1_id,user2_id")
        .eq("id", id)
        .maybeSingle();
      if (!conv) return;
      const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,last_seen,is_verified")
        .eq("id", otherId)
        .maybeSingle();
      setOther(prof as any);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id,sender_id,content,image_url,seen,created_at,reply_to_id,edited_at,deleted_at")
        .eq("conversation_id", id)
        .order("created_at");
      setMessages((msgs as Msg[]) ?? []);

      const ids = (msgs ?? []).map((m: any) => m.id);
      if (ids.length) {
        const { data: rxs } = await supabase
          .from("message_reactions" as any)
          .select("message_id,user_id,emoji")
          .in("message_id", ids);
        setReactions(((rxs as unknown) as Reaction[]) ?? []);
      }

      await supabase.from("messages").update({ seen: true }).eq("conversation_id", id).neq("sender_id", user.id).eq("seen", false);
    };
    init();

    const dbCh = supabase
      .channel(`msgs-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const next = payload.new as Msg;
          setMessages((m) => (m.some((x) => x.id === next.id) ? m : [...m, next]));
          if (next.sender_id !== user.id) {
            supabase.from("messages").update({ seen: true }).eq("id", next.id);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((m) => m.map((x) => (x.id === (payload.new as Msg).id ? (payload.new as Msg) : x)));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((m) => m.filter((x) => x.id !== (payload.old as any).id));
        })
      .subscribe();

    const rxCh = supabase
      .channel(`rx-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setReactions((prev) => [...prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id)), r]);
        } else if (payload.eventType === "UPDATE") {
          const r = payload.new as Reaction;
          setReactions((prev) => prev.map((x) => (x.message_id === r.message_id && x.user_id === r.user_id ? r : x)));
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as Reaction;
          setReactions((prev) => prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id)));
        }
      })
      .subscribe();

    const typingCh = supabase.channel(`typing-${id}`, { config: { broadcast: { self: false } } });
    typingCh
      .on("broadcast", { event: "typing" }, (p) => {
        if (p.payload?.userId !== user.id) {
          setOtherTyping(true);
          setTimeout(() => setOtherTyping(false), 1500);
        }
      })
      .subscribe();
    typingChannelRef.current = typingCh;

    return () => {
      supabase.removeChannel(dbCh);
      supabase.removeChannel(rxCh);
      supabase.removeChannel(typingCh);
    };
  }, [id, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, otherTyping]);

  const sendTyping = () => {
    if (!user || typing) return;
    setTyping(true);
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: user.id } });
    setTimeout(() => setTyping(false), 1200);
  };

  const send = async () => {
    if (!user) return;
    if (editing) return saveEdit();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const replySnapshot = replyTo;
    setReplyTo(null);
    try {
      const { data: m, error } = await supabase.from("messages").insert({
        conversation_id: id,
        sender_id: user.id,
        content,
        reply_to_id: replySnapshot?.id ?? null,
      } as any).select().single();
      if (error) throw error;
      if (m) setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m as Msg]));
      await supabase.from("conversations").update({ last_message: content, last_message_at: new Date().toISOString() }).eq("id", id);
      if (other) {
        await supabase.from("notifications").insert({ user_id: other.id, actor_id: user.id, type: "message" });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File) => {
    if (!user || sending) return;
    setSending(true);
    try {
      const url = await uploadFile("chat", user.id, file);
      const { data: m } = await supabase.from("messages").insert({
        conversation_id: id,
        sender_id: user.id,
        image_url: url,
      }).select().single();
      if (m) setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m as Msg]));
      await supabase.from("conversations").update({ last_message: "📷 Photo", last_message_at: new Date().toISOString() }).eq("id", id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSending(false);
    }
  };

  const deleteChat = async () => {
    if (!confirm("Delete this conversation?")) return;
    await supabase.from("conversations").delete().eq("id", id);
    nav({ to: "/messages" });
  };

  const saveEdit = async () => {
    if (!editing || !user) return;
    const newText = text.trim();
    if (!newText) return;
    const editId = editing.id;
    setEditing(null);
    setText("");
    const { error } = await supabase
      .from("messages")
      .update({ content: newText, edited_at: new Date().toISOString() } as any)
      .eq("id", editId)
      .eq("sender_id", user.id);
    if (error) toast.error(error.message);
  };

  const unsend = async (m: Msg) => {
    if (!user || m.sender_id !== user.id) return;
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), content: null, image_url: null } as any)
      .eq("id", m.id)
      .eq("sender_id", user.id);
    if (error) toast.error(error.message);
  };

  const react = async (m: Msg, emoji: EmojiKey) => {
    if (!user) return;
    const mine = reactions.find((r) => r.message_id === m.id && r.user_id === user.id);
    if (mine?.emoji === emoji) {
      // toggle off
      await supabase.from("message_reactions" as any).delete().eq("message_id", m.id).eq("user_id", user.id);
      setReactions((p) => p.filter((r) => !(r.message_id === m.id && r.user_id === user.id)));
    } else if (mine) {
      await supabase.from("message_reactions" as any).update({ emoji }).eq("message_id", m.id).eq("user_id", user.id);
      setReactions((p) => p.map((r) => (r.message_id === m.id && r.user_id === user.id ? { ...r, emoji } : r)));
    } else {
      await supabase.from("message_reactions" as any).insert({ message_id: m.id, user_id: user.id, emoji });
      setReactions((p) => [...p, { message_id: m.id, user_id: user.id, emoji }]);
    }
    setMenuFor(null);
  };

  const startPress = (m: Msg) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(15);
      setMenuFor(m);
    }, 420);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const online = other && Date.now() - new Date(other.last_seen).getTime() < 60000;
  const lastSeenLabel = (() => {
    if (!other) return "";
    if (online) return "Online";
    const diff = Date.now() - new Date(other.last_seen).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Active now";
    if (m < 60) return `Active ${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Active ${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? "Active yesterday" : `Active ${d}d ago`;
  })();
  const status = otherTyping ? "typing…" : lastSeenLabel;

  // Find last visible mine message for "Seen" label
  const lastMineIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_id === user?.id && !m.deleted_at) return i;
    }
    return -1;
  })();

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="glass-strong px-3 h-16 flex items-center gap-3 border-b border-white/5 safe-top shrink-0">
        <Link to="/messages" className="p-2 -ml-1 rounded-full hover:bg-white/5 transition"><ArrowLeft className="w-5 h-5" /></Link>
        {other && (
          <Link to="/u/$username" params={{ username: other.username }} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative">
              <Avatar url={other.avatar_url} username={other.username} size={40} ring />
              {online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[oklch(0.72_0.2_150)] border-2 border-background" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm truncate">{other.username}</span>
                {other.is_verified && <BadgeCheck className="w-4 h-4 text-[oklch(0.7_0.18_220)] shrink-0" />}
              </div>
              <div className={`text-[11px] ${otherTyping ? "text-gradient font-semibold" : "text-muted-foreground"}`}>{status}</div>
            </div>
          </Link>
        )}
        <button onClick={deleteChat} className="p-2 text-muted-foreground hover:text-destructive rounded-full hover:bg-white/5 transition">
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const replied = m.reply_to_id ? msgMap.get(m.reply_to_id) : null;
            const rx = reactionsByMsg.get(m.id) ?? [];
            const isLastMine = i === lastMineIdx;
            const unsent = !!m.deleted_at;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col ${mine ? "items-end" : "items-start"} pt-2`}
              >
                {replied && (
                  <div className={`text-[10px] text-muted-foreground mb-1 flex items-center gap-1 px-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <CornerUpLeft className="w-3 h-3" />
                    <span>Replying to {replied.sender_id === user?.id ? "you" : other?.username}</span>
                  </div>
                )}
                {replied && (
                  <div className={`max-w-[70%] mb-[-6px] opacity-60 rounded-2xl glass border border-white/10 px-3 py-1.5 text-[11px] truncate ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`}>
                    {replied.deleted_at ? <em>unsent</em> : (replied.content ?? "📷 Photo")}
                  </div>
                )}
                <div
                  onPointerDown={() => !unsent && startPress(m)}
                  onPointerUp={cancelPress}
                  onPointerLeave={cancelPress}
                  onPointerMove={cancelPress}
                  onContextMenu={(e) => { e.preventDefault(); if (!unsent) setMenuFor(m); }}
                  className={`relative max-w-[78%] select-none cursor-pointer ${
                    unsent
                      ? "glass border border-white/10 text-muted-foreground italic"
                      : mine
                      ? "bg-gradient-brand text-primary-foreground shadow-glow"
                      : "glass border border-white/5"
                  } rounded-3xl ${m.image_url && !unsent ? "p-1" : "px-4 py-2.5"} ${mine ? "rounded-br-md" : "rounded-bl-md"}`}
                >
                  {unsent ? (
                    <span className="text-xs">Message unsent</span>
                  ) : m.image_url ? (
                    <img src={m.image_url} className="rounded-2xl max-h-72 object-cover" />
                  ) : (
                    <span className="text-sm leading-snug whitespace-pre-wrap break-words">{m.content}</span>
                  )}
                </div>
                {rx.length > 0 && !unsent && (
                  <div className={`-mt-2 mr-1 ml-1 flex gap-0.5 z-10 ${mine ? "self-end" : "self-start"}`}>
                    {Object.entries(rx.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc; }, {} as Record<string, number>)).map(([emo, n]) => (
                      <span key={emo} className="glass-strong border border-white/10 rounded-full px-1.5 text-[11px] leading-5">
                        {EMOJIS.find((e) => e.key === emo)?.char}{n > 1 && <span className="ml-0.5">{n}</span>}
                      </span>
                    ))}
                  </div>
                )}
                <div className={`text-[10px] text-muted-foreground mt-0.5 px-1 flex items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                  <span>{fmtTime(m.created_at)}</span>
                  {m.edited_at && !unsent && <span>· Edited</span>}
                  {mine && isLastMine && !unsent && (
                    <span>· {m.seen ? seenLabel(m.created_at) : "Sent"}</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {otherTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="glass border border-white/5 rounded-3xl px-4 py-2.5 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Reply / Edit composer banner */}
      {(replyTo || editing) && (
        <div className="px-3 pt-2 glass-strong border-t border-white/5">
          <div className="flex items-center gap-2 rounded-xl glass border border-white/10 px-3 py-2 text-xs">
            <div className="w-1 h-8 bg-gradient-brand rounded-full" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gradient">
                {editing ? "Editing message" : `Replying to ${replyTo?.sender_id === user?.id ? "yourself" : other?.username}`}
              </div>
              <div className="text-muted-foreground truncate">
                {(editing ?? replyTo)?.content ?? "📷 Photo"}
              </div>
            </div>
            <button
              onClick={() => { setReplyTo(null); if (editing) { setEditing(null); setText(""); } }}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 glass-strong border-t border-white/5 safe-bottom shrink-0">
        <div className="flex items-center gap-2 px-2 h-12 rounded-full glass border border-white/10">
          <label className="p-2 cursor-pointer text-muted-foreground hover:text-foreground transition">
            <ImageIcon className="w-5 h-5" />
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
          </label>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); sendTyping(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === "Escape") { setEditing(null); setReplyTo(null); setText(""); } }}
            placeholder={editing ? "Edit message…" : "Message…"}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="grid place-items-center w-9 h-9 rounded-full bg-gradient-brand text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none active:scale-95 transition"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action menu sheet */}
      <AnimatePresence>
        {menuFor && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setMenuFor(null)}
            />
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 inset-x-0 z-50 safe-bottom"
            >
              <div className="mx-auto max-w-md px-3 pb-3">
                <div className="glass-strong border border-white/10 rounded-3xl shadow-card overflow-hidden">
                  <div className="flex items-center justify-around p-3 border-b border-white/5">
                    {EMOJIS.map((e) => {
                      const mineRx = reactions.find((r) => r.message_id === menuFor.id && r.user_id === user?.id);
                      const active = mineRx?.emoji === e.key;
                      return (
                        <motion.button
                          key={e.key}
                          whileTap={{ scale: 0.8 }}
                          whileHover={{ scale: 1.15 }}
                          onClick={() => react(menuFor, e.key)}
                          className={`text-2xl p-1.5 rounded-full ${active ? "bg-white/10" : ""}`}
                          aria-label={e.key}
                        >
                          {e.char}
                        </motion.button>
                      );
                    })}
                  </div>
                  <MenuItem icon={Reply} label="Reply" onClick={() => { setReplyTo(menuFor); setMenuFor(null); inputRef.current?.focus(); }} />
                  {menuFor.content && (
                    <MenuItem icon={Copy} label="Copy" onClick={async () => {
                      try { await navigator.clipboard.writeText(menuFor.content ?? ""); toast.success("Copied"); } catch { toast.error("Copy failed"); }
                      setMenuFor(null);
                    }} />
                  )}
                  {menuFor.sender_id === user?.id && menuFor.content && (
                    <MenuItem icon={Pencil} label="Edit" onClick={() => {
                      setEditing(menuFor); setReplyTo(null); setText(menuFor.content ?? ""); setMenuFor(null);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }} />
                  )}
                  {menuFor.sender_id === user?.id && (
                    <MenuItem icon={Trash2} label="Unsend" danger onClick={() => { unsend(menuFor); setMenuFor(null); }} />
                  )}
                  <button
                    onClick={() => setMenuFor(null)}
                    className="w-full text-center py-3 text-sm font-semibold text-muted-foreground border-t border-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Reply; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium hover:bg-white/5 transition ${danger ? "text-destructive" : ""}`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}
