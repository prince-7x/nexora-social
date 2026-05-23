-- Realtime for group chat + group list ordering
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.groups; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Revoke direct EXECUTE on internal trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.bump_group_last() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_creator_as_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_username() FROM PUBLIC, anon, authenticated;

-- Tighten storage buckets: keep public READ of objects (by direct URL) but disallow anonymous LIST of all files
-- Drop overly-permissive object policies if present and replace with read-by-id only behavior.
-- We achieve "no anonymous listing" by removing any anon SELECT policies on storage.objects for these buckets
-- and only allowing authenticated SELECT. Public file URLs still work via the storage CDN.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (policyname ILIKE '%public%' OR policyname ILIKE '%anyone%' OR policyname ILIKE '%all access%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Allow authenticated users to read object rows in these buckets (listing via SDK requires auth)
CREATE POLICY "auth read avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "auth read posts"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'posts');
CREATE POLICY "auth read chat"    ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat');
CREATE POLICY "auth read stories" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'stories');
