-- Lowercase + format-validate usernames; enforce uniqueness already exists.
-- 1. Normalize existing usernames
UPDATE public.profiles SET username = lower(username) WHERE username <> lower(username);

-- 2. Trigger to auto-lowercase + validate format on insert/update
CREATE OR REPLACE FUNCTION public.normalize_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.username := lower(NEW.username);
  IF NEW.username !~ '^[a-z0-9_.]{3,20}$' THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 chars: a-z, 0-9, _ or .';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_normalize_username ON public.profiles;
CREATE TRIGGER profiles_normalize_username
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_username();

-- 3. Update handle_new_user to lowercase + sanitize
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  v_username := lower(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  v_username := regexp_replace(v_username, '[^a-z0-9_.]', '_', 'g');
  IF length(v_username) < 3 THEN v_username := v_username || '_user'; END IF;
  IF length(v_username) > 20 THEN v_username := substr(v_username, 1, 20); END IF;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := substr(v_username, 1, 16) || floor(random()*10000)::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, full_name) VALUES (NEW.id, v_username, v_full_name);
  RETURN NEW;
END;
$$;

-- 4. Helper: can_message(sender, recipient) — enforces private-account follow-back rule
CREATE OR REPLACE FUNCTION public.can_message(_sender uuid, _recipient uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Not blocked either way
    NOT EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = _recipient AND blocked_id = _sender)
         OR (blocker_id = _sender AND blocked_id = _recipient)
    )
    AND (
      -- Recipient is public OR recipient follows sender back (accepted)
      (SELECT NOT is_private FROM public.profiles WHERE id = _recipient)
      OR EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = _recipient AND following_id = _sender AND status = 'accepted'
      )
    );
$$;

-- 5. Tighten conversation insert: require can_message both sides
DROP POLICY IF EXISTS "conv insert participant" ON public.conversations;
CREATE POLICY "conv insert participant"
ON public.conversations
FOR INSERT
WITH CHECK (
  (auth.uid() = user1_id OR auth.uid() = user2_id)
  AND public.can_message(auth.uid(),
    CASE WHEN auth.uid() = user1_id THEN user2_id ELSE user1_id END)
);

-- 6. Tighten message insert similarly
DROP POLICY IF EXISTS "messages insert sender" ON public.messages;
CREATE POLICY "messages insert sender"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
      AND public.can_message(auth.uid(),
        CASE WHEN auth.uid() = c.user1_id THEN c.user2_id ELSE c.user1_id END)
  )
);