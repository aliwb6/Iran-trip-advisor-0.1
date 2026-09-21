-- Public article pages must be readable by visitors as well as signed-in users.
-- Keep drafts, pending articles, and rejected articles private.
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS articles_public_read_published ON public.articles;

CREATE POLICY articles_public_read_published
  ON public.articles
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' AND is_published IS TRUE);

GRANT SELECT ON TABLE public.articles TO anon, authenticated;
