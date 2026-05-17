
-- Theme preference + nickname on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'amoled-pink';

-- Per-conversation nickname for the OTHER user
CREATE TABLE IF NOT EXISTS public.conversation_nicknames (
  conversation_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  target_id UUID NOT NULL,
  nickname TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, owner_id)
);
ALTER TABLE public.conversation_nicknames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nick select self" ON public.conversation_nicknames FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "nick upsert self" ON public.conversation_nicknames FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "nick update self" ON public.conversation_nicknames FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "nick delete self" ON public.conversation_nicknames FOR DELETE USING (auth.uid() = owner_id);

-- Groups
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- admin|member
  status TEXT NOT NULL DEFAULT 'approved', -- pending|approved
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  reply_to_id UUID,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Helper functions to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_group_member(_g UUID, _u UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id=_g AND user_id=_u AND status='approved');
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_g UUID, _u UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id=_g AND user_id=_u AND role='admin' AND status='approved');
$$;

-- Groups policies
CREATE POLICY "groups select member" ON public.groups FOR SELECT USING (public.is_group_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "groups insert self" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups update admin" ON public.groups FOR UPDATE USING (public.is_group_admin(id, auth.uid()));
CREATE POLICY "groups delete creator" ON public.groups FOR DELETE USING (auth.uid() = created_by);

-- group_members policies
CREATE POLICY "gm select member" ON public.group_members FOR SELECT USING (public.is_group_member(group_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "gm insert admin or self join" ON public.group_members FOR INSERT WITH CHECK (
  public.is_group_admin(group_id, auth.uid()) OR auth.uid() = user_id
);
CREATE POLICY "gm update admin or self leave" ON public.group_members FOR UPDATE USING (
  public.is_group_admin(group_id, auth.uid()) OR auth.uid() = user_id
);
CREATE POLICY "gm delete admin or self" ON public.group_members FOR DELETE USING (
  public.is_group_admin(group_id, auth.uid()) OR auth.uid() = user_id
);

-- group_messages policies
CREATE POLICY "gmsg select member" ON public.group_messages FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "gmsg insert member" ON public.group_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND public.is_group_member(group_id, auth.uid())
);
CREATE POLICY "gmsg update sender" ON public.group_messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "gmsg delete sender or admin" ON public.group_messages FOR DELETE USING (
  auth.uid() = sender_id OR public.is_group_admin(group_id, auth.uid())
);

-- Auto-add creator as admin when a group is created
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role, status, added_by)
  VALUES (NEW.id, NEW.created_by, 'admin', 'approved', NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_groups_add_creator ON public.groups;
CREATE TRIGGER trg_groups_add_creator AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_admin();

-- Bump group last_message_at
CREATE OR REPLACE FUNCTION public.bump_group_last()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.groups
    SET last_message = COALESCE(NEW.content, '📷 Image'),
        last_message_at = NEW.created_at
    WHERE id = NEW.group_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gmsg_bump ON public.group_messages;
CREATE TRIGGER trg_gmsg_bump AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_last();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
