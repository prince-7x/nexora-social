import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Image as ImageIcon, Send, Trash2 } from "lucide-react";
import { uploadFile } from "@/lib/upload";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Msg = { id: string; sender_id: string; content: string | null; image_url: string | null; seen: boolean; created_at: string };

export const Route = createFileRoute("/_authenticated/messages/$id")({
  component: ChatPage,
});

function ChatPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [other, setOther] = useState<{ id: string; username: string; avatar_url: string | null; last_seen: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
        .select("id,username,avatar_url,last_seen")
        .eq("id", otherId)
        .maybeSingle();
      setOther(prof);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id,sender_id,content,image_url,seen,created_at")
        .eq("conversation_id", id)
        .order("created_at");
      setMessages(msgs ?? []);

      // mark seen for messages from other user
      await supabase.from("messages").update({ seen: true }).eq("conversation_id", id).neq("sender_id", user.id).eq("seen", false);
    };
    init();

    const dbCh = supabase
      .channel(`msgs-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as Msg]);
          if ((payload.new as Msg).sender_id !== user.id) {
            supabase.from("messages").update({ seen: true }).eq("id", (payload.new as Msg).id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((m) => m.map((x) => (x.id === (payload.new as Msg).id ? (payload.new as Msg) : x)));
        }
      )
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
    if (!user || (!text.trim() && !sending)) return;
    const content = text.trim();
    if (!content) return;
    setText("");
    const { data: m } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content,
    }).select().single();
    if (m) setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m as Msg]));
    await supabase.from("conversations").update({ last_message: content, last_message_at: new Date().toISOString() }).eq("id", id);
    if (other) {
      await supabase.from("notifications").insert({ user_id: other.id, actor_id: user.id, type: "message" });
    }
  };

  const sendImage = async (file: File) => {
    if (!user) return;
    setSending(true);
    try {
      const url = await uploadFile("chat", user.id, file);
      const { data: m } = await supabase.from("messages").insert({
        conversation_id: id,
        sender_id: user.id,
        image_url: url,
      }).select().single();
      if (m) setMessages((prev) => [...prev, m as Msg]);
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

  const online = other && Date.now() - new Date(other.last_seen).getTime() < 60000;

  return (
    <div className="flex flex-col h-screen">
      <header className="glass-strong px-3 h-14 flex items-center gap-3 border-b border-border safe-top shrink-0">
        <Link to="/messages" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        {other && (
          <Link to="/u/$username" params={{ username: other.username }} className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar url={other.avatar_url} username={other.username} size={36} ring />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{other.username}</div>
              <div className="text-xs text-muted-foreground">{online ? "Active now" : "Offline"}</div>
            </div>
          </Link>
        )}
        <button onClick={deleteChat} className="p-2 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const last = i === messages.length - 1;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "bg-gradient-brand text-primary-foreground" : "glass"} rounded-3xl ${m.image_url ? "p-1" : "px-4 py-2"}`}>
                {m.image_url ? (
                  <img src={m.image_url} className="rounded-2xl max-h-72 object-cover" />
                ) : (
                  <span className="text-sm whitespace-pre-wrap break-words">{m.content}</span>
                )}
              </div>
              {mine && last && (
                <span className="self-end ml-1 text-[10px] text-muted-foreground">{m.seen ? "Seen" : "Sent"}</span>
              )}
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="glass rounded-3xl px-4 py-2 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 glass-strong border-t border-border safe-bottom shrink-0">
        <div className="flex items-center gap-2 px-2 h-12 rounded-full glass">
          <label className="p-2 cursor-pointer text-muted-foreground hover:text-foreground">
            <ImageIcon className="w-5 h-5" />
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
          </label>
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); sendTyping(); }}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="p-2 text-primary disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
