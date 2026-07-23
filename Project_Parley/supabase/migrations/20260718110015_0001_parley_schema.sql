/*
# Parley — core schema (profiles, videos, matches, conversations, messages, likes, intros)

1. Purpose
   Parley is a founder ↔ investor networking app. Founders post short pitch videos;
   investors browse a vertical feed, run AI matchmaking, request intros, and chat.
   This migration creates the full data model and RLS policies for an authenticated
   (sign-in required) multi-tenant app where every row is owned by a user.

2. New Tables
   - `profiles` — extends auth.users. user_type (founder/investor), name, avatar, company, bio,
     plus matchmaking vectors and thesis/fit fields.
   - `videos` — founder pitch videos. owner = user_id. includes title, description, tags,
     intent badges, traction metrics, like count, public sample flag.
   - `likes` — join table user_id ↔ video_id for likes.
   - `matches` — founder_id ↔ investor_id with score (0-100), status, reason text.
   - `conversations` — 1:1 thread between two users. nda_required flag.
   - `messages` — chat messages in a conversation. sender_id, content.
   - `intros` — intro requests from investor → founder (linked to a video or match).

3. Security (RLS)
   - RLS enabled on every table.
   - `profiles`: anyone authenticated can read (so feed/matches show names); users can
     update only their own profile.
   - `videos`: anyone authenticated can read; only owner can insert/update/delete own.
   - `likes`: anyone authenticated can read; users can like/unlike only for themselves.
   - `matches`: both founder and investor participants can read; either can insert a row
     where they are a participant; updates allowed for participants.
   - `conversations`: participants can read, insert (must be a participant), update NDA flag.
   - `messages`: participants of the parent conversation can read; sender must be a
     participant to insert.
   - `intros`: target founder + requesting investor can read; investor can insert for self.

4. Notes
   - All owner/participant columns use DEFAULT auth.uid() where the client is expected
     to insert without explicitly passing the id (videos.user_id, likes.user_id,
     messages.sender_id, intros.investor_id).
   - `auth.uid()` is used everywhere — never `current_user`.
   - Sample data is inserted via a separate migration (0002_parley_seed) so re-running
     this migration stays idempotent.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('founder','investor')),
  name text NOT NULL DEFAULT '',
  avatar text,
  company text,
  bio text,
  -- founder profile fields
  stage text,
  sector text,
  funding_goal text,
  traction text,
  location text,
  fit_answers jsonb DEFAULT '{}'::jsonb,
  compatibility_vector jsonb DEFAULT '[]'::jsonb,
  -- investor profile fields
  preferred_stages text[] DEFAULT '{}',
  preferred_sectors text[] DEFAULT '{}',
  check_size text,
  board_style text,
  investor_vector jsonb DEFAULT '[]'::jsonb,
  -- verification
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- videos ----------
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  poster text,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  tags text[] DEFAULT '{}'::text[],
  intent text[] DEFAULT '{}'::text[],
  traction jsonb DEFAULT '{}'::jsonb,
  stage text,
  sector text,
  location text,
  likes_count integer NOT NULL DEFAULT 0,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "videos_read_all" ON videos;
CREATE POLICY "videos_read_all" ON videos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "videos_insert_own" ON videos;
CREATE POLICY "videos_insert_own" ON videos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "videos_update_own" ON videos;
CREATE POLICY "videos_update_own" ON videos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "videos_delete_own" ON videos;
CREATE POLICY "videos_delete_own" ON videos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS videos_created_at_idx ON videos (created_at DESC);
CREATE INDEX IF NOT EXISTS videos_user_id_idx ON videos (user_id);

-- ---------- likes ----------
CREATE TABLE IF NOT EXISTS likes (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_read_all" ON likes;
CREATE POLICY "likes_read_all" ON likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own" ON likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_own" ON likes;
CREATE POLICY "likes_delete_own" ON likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS likes_video_id_idx ON likes (video_id);

-- ---------- matches ----------
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','requested','accepted','declined')),
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_read_participants" ON matches;
CREATE POLICY "matches_read_participants" ON matches FOR SELECT
  TO authenticated USING (auth.uid() = founder_id OR auth.uid() = investor_id);

DROP POLICY IF EXISTS "matches_insert_participant" ON matches;
CREATE POLICY "matches_insert_participant" ON matches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = founder_id OR auth.uid() = investor_id);

DROP POLICY IF EXISTS "matches_update_participant" ON matches;
CREATE POLICY "matches_update_participant" ON matches FOR UPDATE
  TO authenticated USING (auth.uid() = founder_id OR auth.uid() = investor_id)
  WITH CHECK (auth.uid() = founder_id OR auth.uid() = investor_id);

-- ---------- conversations ----------
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nda_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_distinct_users CHECK (user_a <> user_b)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_read_participants" ON conversations;
CREATE POLICY "conversations_read_participants" ON conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "conversations_insert_participant" ON conversations;
CREATE POLICY "conversations_insert_participant" ON conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;
CREATE POLICY "conversations_update_participant" ON conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- ---------- messages ----------
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_participants" ON messages;
CREATE POLICY "messages_read_participants" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    ) AND auth.uid() = sender_id
  );

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id, created_at);

-- ---------- intros ----------
CREATE TABLE IF NOT EXISTS intros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid REFERENCES videos(id) ON DELETE SET NULL,
  match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE intros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intros_read_participants" ON intros;
CREATE POLICY "intros_read_participants" ON intros FOR SELECT
  TO authenticated USING (auth.uid() = investor_id OR auth.uid() = founder_id);

DROP POLICY IF EXISTS "intros_insert_investor" ON intros;
CREATE POLICY "intros_insert_investor" ON intros FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = investor_id);

DROP POLICY IF EXISTS "intros_update_participants" ON intros;
CREATE POLICY "intros_update_participants" ON intros FOR UPDATE
  TO authenticated USING (auth.uid() = investor_id OR auth.uid() = founder_id)
  WITH CHECK (auth.uid() = investor_id OR auth.uid() = founder_id);

-- ---------- updated_at trigger for profiles ----------
CREATE OR REPLACE FUNCTION parley_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION parley_set_updated_at();
