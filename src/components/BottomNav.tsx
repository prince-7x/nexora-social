import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, PlusSquare, Heart, MessageCircle, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";

export function BottomNav() {
  const { profile } = useAuth();
  const loc = useLocation();
  const items = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/explore", icon: Search, label: "Explore" },
    { to: "/create", icon: PlusSquare, label: "Create" },
    { to: "/notifications", icon: Heart, label: "Activity" },
    { to: "/messages", icon: MessageCircle, label: "Chat" },
    { to: profile ? `/u/${profile.username}` : "/", icon: User, label: "Me" },
  ] as const;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md glass-strong border-t border-border">
        <ul className="flex justify-around items-center h-16 px-2">
          {items.map(({ to, icon: Icon, label }) => {
            const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
            return (
              <li key={label} className="relative">
                <Link to={to} className="flex flex-col items-center justify-center w-12 h-12">
                  {active && (
                    <motion.span
                      layoutId="navdot"
                      className="absolute -top-0 w-8 h-1 rounded-full bg-gradient-brand"
                    />
                  )}
                  <Icon
                    className={`w-6 h-6 transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
