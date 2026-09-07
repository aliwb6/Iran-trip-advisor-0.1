-- Direct messages between tourists and guides.
-- The existing `messages` table was provisioned for the AI chatbot only
-- (conversation_id + role 'user'/'assistant'). We extend it additively so
-- the same table can carry tourist↔guide DMs without disturbing AI chat rows.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_id   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_read     boolean DEFAULT false;

-- DMs don't belong to a `conversations` row and don't use AI role labels.
ALTER TABLE messages ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE messages ALTER COLUMN role            DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver
  ON messages(sender_id, receiver_id);

-- Allow DM participants (sender or receiver) to read/write their messages,
-- while keeping AI-chat access (rows joined via conversations.user_id).
DROP POLICY IF EXISTS "Users see own messages" ON messages;
CREATE POLICY "Users see own messages" ON messages
  FOR ALL
  USING (
    (conversation_id IS NOT NULL
      AND conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()))
    OR sender_id   = auth.uid()
    OR receiver_id = auth.uid()
  )
  WITH CHECK (
    (conversation_id IS NOT NULL
      AND conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()))
    OR sender_id   = auth.uid()
  );
