import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { motion } from "framer-motion";

type Group = {
  id: string;
  name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string;
};

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsList,
});

function GroupsList() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: mem } = await supabase
      .from("group_members" as any)
      .select("group_id")
      .eq("user_id", user.id)
      .eq("status", "approved");
    const ids = (mem ?? []).map((m: any) => m.group_id);
    if (!ids.length) { setGroups([]); return; }
    const { data } = await supabase
      .from("groups" as any)
      .select("id,name,avatar_url,last_message,last_message_at")
      .in("id", ids)
      .order("last_message_at", { ascending: false });
    setGroups((data ?? []) as Group[]);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("groups-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <div>
      <header className="sticky top-0 z-30 glass-strong px-3 h-14 flex items-center justify-between safe-top">
        <Link to="/messages" className="p-2 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display font-bold">Groups</h1>
        <Link to="/groups/new" className="p-2 -mr-1"><Plus className="w-5 h-5 text-primary" /></Link>
      </header>

      {groups.length === 0 ? (
        <div className="text-center py-20 px-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-brand-soft grid place-items-center mb-4">
            <Users className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display font-bold text-lg">No groups yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create one and add your friends.</p>
          <Link
            to="/groups/new"
            className="inline-flex mt-5 items-center gap-2 px-5 h-11 rounded-full bg-gradient-brand text-primary-foreground font-semibold text-sm shadow-glow"
          >
            <Plus className="w-4 h-4" /> Create group
          </Link>
        </div>
      ) : (
        <ul className="px-2 py-2">
          {groups.map((g) => (
            <motion.li key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Link
                to="/groups/$id"
                params={{ id: g.id }}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted/40 transition"
              >
                <div className="w-13 h-13 rounded-full p-[2px] bg-gradient-brand">
                  <div className="w-full h-full rounded-full bg-background grid place-items-center overflow-hidden" style={{ width: 52, height: 52 }}>
                    {g.avatar_url ? (
                      <img src={g.avatar_url} alt={g.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-primary" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{g.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{g.last_message || "New group · say hi 👋"}</div>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
