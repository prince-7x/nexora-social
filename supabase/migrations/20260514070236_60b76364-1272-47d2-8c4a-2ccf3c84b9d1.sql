-- 1. STORIES
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  music_title TEXT,
  music_artist TEXT,
  music_preview_url TEXT,
  music_cover_url TEXT,
  close_friends_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX idx_stories_user_active ON public.stories(user_id, expires_at);
CREATE INDEX idx_stories_expires ON public.stories(expires_at);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- 2. CLOSE FRIENDS first
CREATE TABLE public.close_friends (
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);
ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf select self" ON public.close_friends
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cf insert self" ON public.close_friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cf delete self" ON public.close_friends
  FOR DELETE USING (auth.uid() = user_id);

-- helper
CREATE OR REPLACE FUNCTION public.can_view_story(_viewer uuid, _author uuid, _close_only boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = _author AND blocked_id = _viewer)
         OR (blocker_id = _viewer AND blocked_id = _author)
    )
    AND (
      _viewer = _author
      OR (
        (NOT _close_only OR EXISTS (
          SELECT 1 FROM public.close_friends
          WHERE user_id = _author AND friend_id = _viewer
        ))
        AND (
          (SELECT NOT is_private FROM public.profiles WHERE id = _author)
          OR EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = _viewer AND following_id = _author AND status = 'accepted'
          )
        )
      )
    );
$$;

CREATE POLICY "stories select visible" ON public.stories
  FOR SELECT USING (
    expires_at > now()
    AND public.can_view_story(auth.uid(), user_id, close_friends_only)
  );
CREATE POLICY "stories insert self" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories delete self" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- 3. STORY VIEWS
CREATE TABLE public.story_views (
  story_id UUID NOT NULL,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv insert viewer" ON public.story_views
  FOR INSERT WITH CHECK (
    auth.uid() = viewer_id
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_views.story_id
        AND s.expires_at > now()
        AND public.can_view_story(auth.uid(), s.user_id, s.close_friends_only)
    )
  );
CREATE POLICY "sv select author or self" ON public.story_views
  FOR SELECT USING (
    auth.uid() = viewer_id
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
  );

-- 4. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "stories bucket public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "stories bucket upload self" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "stories bucket delete self" ON storage.objects
  FOR DELETE USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.can_view_story(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_story(uuid, uuid, boolean) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'expire-stories',
  '*/30 * * * *',
  $$ DELETE FROM public.stories WHERE expires_at <= now(); $$
);