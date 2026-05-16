
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Restrict UPDATE on messages: only sender may edit/unsend, and only content/edited_at/deleted_at columns matter.
DROP POLICY IF EXISTS "messages update participant" ON public.messages;
CREATE POLICY "messages update sender only"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('heart','fire','laugh','like','sad','angry')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions select participant"
  ON public.message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  ));

CREATE POLICY "reactions insert self"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
    )
  );

CREATE POLICY "reactions delete self"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "reactions update self"
  ON public.message_reactions FOR UPDATE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
