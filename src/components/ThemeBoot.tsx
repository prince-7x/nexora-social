import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, readStoredTheme, type ThemeId } from "@/lib/themes";

/** Applies the user's saved theme at boot and on profile change. */
export function ThemeBoot() {
  const { user } = useAuth();

  // Apply immediately from localStorage to avoid flash
  useEffect(() => {
    applyTheme(readStoredTheme());
  }, []);

  // When signed in, pull from profile and override
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .maybeSingle();
      const t = (data?.theme as ThemeId) || readStoredTheme();
      if (!cancelled) applyTheme(t);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return null;
}
