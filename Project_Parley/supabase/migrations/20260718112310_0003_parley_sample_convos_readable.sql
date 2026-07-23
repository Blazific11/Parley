/*
# Parley — make sample conversations readable + add is_sample flag

1. Purpose
   Sample conversations are seeded with synthetic user ids ('sample-founder-1' etc.)
   that no real auth.uid() matches, so the existing conversations_read_participants
   policy hides them from real users. We want real users to SEE sample conversations
   in their inbox (so the Messages tab is populated for demo), while still only
   allowing participants to read/write REAL conversations.

2. Changes
   - Add `is_sample boolean NOT NULL DEFAULT false` to conversations.
   - Update the sample conversation rows to is_sample = true.
   - Replace conversations_read_participants SELECT policy with one that allows
     authenticated users to read rows where they're a participant OR is_sample = true.
   - Keep insert/update policies participant-scoped (only real participants can
     create/modify their own conversations — sample rows stay read-only).

3. Security
   - Real users can still only INSERT conversations where they're a participant.
   - Real users can still only UPDATE (e.g. NDA toggle) conversations where they're
     a participant. Sample conversations can't be modified by real users.
*/

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

UPDATE conversations SET is_sample = true WHERE id IN ('sample-conv-1','sample-conv-2','sample-conv-3');

DROP POLICY IF EXISTS "conversations_read_participants" ON conversations;
CREATE POLICY "conversations_read_participants" ON conversations FOR SELECT
  TO authenticated USING (auth.uid()::text = user_a OR auth.uid()::text = user_b OR is_sample = true);

-- messages: allow reading messages in sample conversations too
DROP POLICY IF EXISTS "messages_read_participants" ON messages;
CREATE POLICY "messages_read_participants" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid()::text OR c.user_b = auth.uid()::text OR c.is_sample = true)
    )
  );
