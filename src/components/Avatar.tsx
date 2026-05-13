import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import type { Profile } from "@/lib/auth";

export function Avatar({
  url,
  username,
  size = 40,
  ring = false,
}: {
  url?: string | null;
  username?: string;
  size?: number;
  ring?: boolean;
}) {
  const initial = (username ?? "?").slice(0, 1).toUpperCase();
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 ${
        ring ? "p-[2px] bg-gradient-brand" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-full overflow-hidden bg-muted flex items-center justify-center">
        {url ? (
          <img src={url} alt={username ?? ""} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">{initial}</span>
        )}
      </div>
    </div>
  );
}

export function ProfileChip({
  profile,
  size = 36,
  showVerified = true,
  ring = false,
  subtitle,
}: {
  profile: Pick<Profile, "username" | "avatar_url" | "is_verified" | "full_name">;
  size?: number;
  showVerified?: boolean;
  ring?: boolean;
  subtitle?: string;
}) {
  return (
    <Link to="/u/$username" params={{ username: profile.username }} className="flex items-center gap-3 min-w-0">
      <Avatar url={profile.avatar_url} username={profile.username} size={size} ring={ring} />
      <div className="min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-semibold text-sm truncate">{profile.username}</span>
          {showVerified && profile.is_verified && (
            <BadgeCheck className="w-4 h-4 text-[oklch(0.7_0.18_220)] shrink-0" />
          )}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
      </div>
    </Link>
  );
}
