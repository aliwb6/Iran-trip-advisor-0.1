-- Store Arabic article content separately so switching the application language
-- does not overwrite or reuse Persian/English content.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS excerpt_ar text,
  ADD COLUMN IF NOT EXISTS content_ar text;
