import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if `me` can DM `target`:
 * - target is public, OR
 * - target follows me back (accepted)
 * AND no block exists either way.
 */
export async function canMessage(meId: string, targetId: string): Promise<boolean> {
  if (meId === targetId) return false;
  const [{ data: target }, { data: blocks }, { data: backFollow }] = await Promise.all([
    supabase.from("profiles").select("is_private").eq("id", targetId).maybeSingle(),
    supabase
      .from("blocks")
      .select("blocker_id,blocked_id")
      .or(
        `and(blocker_id.eq.${meId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${meId})`
      ),
    supabase
      .from("follows")
      .select("status")
      .eq("follower_id", targetId)
      .eq("following_id", meId)
      .eq("status", "accepted")
      .maybeSingle(),
  ]);
  if (blocks && blocks.length > 0) return false;
  if (!target) return false;
  if (!target.is_private) return true;
  return !!backFollow;
}

export async function followBack(meId: string, targetId: string) {
  // Insert if not exists; if target is private, status will be pending; else accepted
  const { data: targetProf } = await supabase
    .from("profiles")
    .select("is_private")
    .eq("id", targetId)
    .maybeSingle();
  const status = targetProf?.is_private ? "pending" : "accepted";
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: meId, following_id: targetId, status });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
  await supabase
    .from("notifications")
    .insert({ user_id: targetId, actor_id: meId, type: status === "pending" ? "follow_request" : "follow" });
  return status;
}

export async function blockUser(meId: string, targetId: string) {
  // Remove any follow relationships both directions, then insert block
  await supabase
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${meId},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${meId})`
    );
  await supabase.from("blocks").insert({ blocker_id: meId, blocked_id: targetId });
}

export async function unblockUser(meId: string, targetId: string) {
  await supabase.from("blocks").delete().eq("blocker_id", meId).eq("blocked_id", targetId);
}

export async function isBlocked(meId: string, targetId: string): Promise<boolean> {
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", meId)
    .eq("blocked_id", targetId)
    .maybeSingle();
  return !!data;
}
