-- Create custom_trips table
CREATE TABLE custom_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT status_check CHECK (status IN ('draft', 'saved', 'booked', 'completed'))
);

-- Create index for user_id
CREATE INDEX idx_custom_trips_user_id ON custom_trips(user_id);
CREATE INDEX idx_custom_trips_status ON custom_trips(status);
CREATE INDEX idx_custom_trips_created_at ON custom_trips(created_at DESC);

-- Enable RLS
ALTER TABLE custom_trips ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own trips
CREATE POLICY "Users can view their own trips"
  ON custom_trips FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to create their own trips
CREATE POLICY "Users can create their own trips"
  ON custom_trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own trips
CREATE POLICY "Users can update their own trips"
  ON custom_trips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own trips
CREATE POLICY "Users can delete their own trips"
  ON custom_trips FOR DELETE
  USING (auth.uid() = user_id);
