-- Ensure is_approved column defaults to false for new profiles
-- (guards against the handle_new_user trigger not setting it explicitly)
ALTER TABLE profiles
  ALTER COLUMN is_approved SET DEFAULT false;

-- Ensure bio column exists so guide/agency profile writes never fail silently
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Backfill: any guide/agency row with NULL is_approved should be treated as pending
UPDATE profiles
  SET is_approved = false
  WHERE role IN ('guide', 'agency') AND is_approved IS NULL;
