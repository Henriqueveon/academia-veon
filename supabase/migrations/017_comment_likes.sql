-- Create comment_likes table for post feed comments
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read comment_likes"
  ON public.comment_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can like comments"
  ON public.comment_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike their own likes"
  ON public.comment_likes FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON public.comment_likes(comment_id);

-- Atomic toggle: returns true if now liked, false if unliked
CREATE OR REPLACE FUNCTION public.toggle_comment_like(p_comment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.comment_likes
    WHERE comment_id = p_comment_id AND user_id = v_user
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.comment_likes
    WHERE comment_id = p_comment_id AND user_id = v_user;
    RETURN false;
  ELSE
    INSERT INTO public.comment_likes(comment_id, user_id)
    VALUES (p_comment_id, v_user);
    RETURN true;
  END IF;
END;
$$;
