-- Add license and publication columns to profiles table
ALTER TABLE profiles
ADD COLUMN phone_number TEXT,
ADD COLUMN license_url TEXT,
ADD COLUMN license_status VARCHAR(50) DEFAULT 'not_uploaded',
ADD COLUMN is_published BOOLEAN DEFAULT false;

-- Add constraint for license_status values
ALTER TABLE profiles
ADD CONSTRAINT license_status_check CHECK (license_status IN ('not_uploaded', 'pending_review', 'verified'));

-- Create index for license_status to optimize filtering
CREATE INDEX idx_profiles_license_status ON profiles(license_status);
CREATE INDEX idx_profiles_is_published ON profiles(is_published);

-- Create storage bucket for licenses if it doesn't exist
-- Note: This would normally be done via the Supabase console or API
-- The bucket should be named "licenses" with appropriate RLS policies
