import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Plus, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";

export function BottomNav() {
  const { profile } = useAuth();
  const loc = useLocation();
  const items = [
    { to: "/", icon: Home, label: "Home", match: (p: string) => p === "/" },
    { to: "/explore", icon: Search, label: "Search", match: (p: string) => p.startsWith("/explore") },
    { to: "/create", icon: Plus, label: "Create", match: (p: string) => p.startsWith("/create"), accent: true },
    { to: "/messages", icon: MessageSquare, label: "Chat", match: (p: string) => p.startsWith("/messages") },
    {
      to: profile ? `/u/${profile.username}` : "/",
      icon: User,
      label: "Me",
      match: (p: string) => p.startsWith("/u/"),
    },
  ] as const;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom pointer-events-none">
      <div className="mx-auto max-w-md px-4 pb-3 pointer-events-auto">
        <div className="glass-strong rounded-2xl border border-white/10 shadow-card">
          <ul className="flex justify-around items-center h-16 px-2">
            {items.map(({ to, icon: Icon, label, match, accent }) => {
              const active = match(loc.pathname);
              return (
                <li key={label} className="relative flex-1">
                  <Link to={to} className="flex flex-col items-center justify-center h-14 group">
                    {accent ? (
                      <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-brand shadow-glow group-active:scale-95 transition">
                        <Icon className="w-5 h-5 text-primary-foreground" strokeWidth={2.6} />
                      </span>
                    ) : (
                      <>
                        {active && (
                          <motion.span
                            layoutId="navdot"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-gradient-brand"
                          />
                        )}
                        <Icon
                          className={`w-[26px] h-[26px] transition-colors ${
                            active ? "text-foreground" : "text-muted-foreground"
                          }`}
                          strokeWidth={active ? 2.4 : 1.8}
                          fill={active && (label === "Home") ? "currentColor" : "none"}
                        />
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
