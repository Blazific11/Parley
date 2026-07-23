/*
# Parley — seed sample data (founders, investors, videos, matches, conversations, messages)

1. Purpose
   Seed 10 sample founders, 3 sample investors, 10 sample pitch videos, 5 sample
   matches, and 3 sample conversations so the Feed, Match, and Messages tabs show
   real persisted data immediately.

2. Approach
   The original schema's id / FK columns are uuid, which blocks inserting sample
   rows with string ids like 'sample-founder-1'. We:
     a. Drop RLS policies that reference the columns we alter.
     b. Drop FK constraints pointing to auth.users and across tables.
     c. Drop the conversations_distinct_users CHECK (breaks mid-alter).
     d. ALTER every id / FK column from uuid to text so sample string ids coexist
        with real auth.uid() uuid strings.
     e. Re-create the CHECK constraint and RLS policies, casting auth.uid()::text
        in every policy (auth.uid() returns uuid; text = uuid has no operator).
     f. Insert sample rows with is_sample = true.

   Non-destructive: tables are empty, no data lost. Real auth.uid() values are
   distinct UUIDs that never collide with 'sample-*' ids.

3. Security
   RLS stays enabled. Real users only read/write their own rows. Sample rows use
   synthetic ids no real auth.uid() matches, so they're read-only via the client.
*/

-- ---------- Drop policies ----------
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "videos_read_all" ON videos;
DROP POLICY IF EXISTS "videos_insert_own" ON videos;
DROP POLICY IF EXISTS "videos_update_own" ON videos;
DROP POLICY IF EXISTS "videos_delete_own" ON videos;
DROP POLICY IF EXISTS "likes_read_all" ON likes;
DROP POLICY IF EXISTS "likes_insert_own" ON likes;
DROP POLICY IF EXISTS "likes_delete_own" ON likes;
DROP POLICY IF EXISTS "matches_read_participants" ON matches;
DROP POLICY IF EXISTS "matches_insert_participant" ON matches;
DROP POLICY IF EXISTS "matches_update_participant" ON matches;
DROP POLICY IF EXISTS "conversations_read_participants" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_participant" ON conversations;
DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;
DROP POLICY IF EXISTS "messages_read_participants" ON messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
DROP POLICY IF EXISTS "intros_read_participants" ON intros;
DROP POLICY IF EXISTS "intros_insert_investor" ON intros;
DROP POLICY IF EXISTS "intros_update_participants" ON intros;

-- ---------- Drop FK + CHECK ----------
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_user_id_fkey;
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_video_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_founder_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_investor_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_a_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_b_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_distinct_users;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE intros DROP CONSTRAINT IF EXISTS intros_investor_id_fkey;
ALTER TABLE intros DROP CONSTRAINT IF EXISTS intros_founder_id_fkey;
ALTER TABLE intros DROP CONSTRAINT IF EXISTS intros_video_id_fkey;
ALTER TABLE intros DROP CONSTRAINT IF EXISTS intros_match_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ---------- Alter ALL id / FK columns to text ----------
ALTER TABLE profiles ALTER COLUMN id TYPE text;
ALTER TABLE videos ALTER COLUMN id TYPE text;
ALTER TABLE videos ALTER COLUMN user_id TYPE text;
ALTER TABLE likes ALTER COLUMN user_id TYPE text;
ALTER TABLE likes ALTER COLUMN video_id TYPE text;
ALTER TABLE matches ALTER COLUMN id TYPE text;
ALTER TABLE matches ALTER COLUMN founder_id TYPE text;
ALTER TABLE matches ALTER COLUMN investor_id TYPE text;
ALTER TABLE conversations ALTER COLUMN id TYPE text;
ALTER TABLE conversations ALTER COLUMN user_a TYPE text;
ALTER TABLE conversations ALTER COLUMN user_b TYPE text;
ALTER TABLE messages ALTER COLUMN id TYPE text;
ALTER TABLE messages ALTER COLUMN conversation_id TYPE text;
ALTER TABLE messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE intros ALTER COLUMN id TYPE text;
ALTER TABLE intros ALTER COLUMN investor_id TYPE text;
ALTER TABLE intros ALTER COLUMN founder_id TYPE text;
ALTER TABLE intros ALTER COLUMN video_id TYPE text;
ALTER TABLE intros ALTER COLUMN match_id TYPE text;

-- ---------- Re-create CHECK ----------
ALTER TABLE conversations ADD CONSTRAINT conversations_distinct_users CHECK (user_a <> user_b);

-- ---------- Re-create RLS policies (auth.uid()::text cast) ----------
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = id);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);

CREATE POLICY "videos_read_all" ON videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "videos_insert_own" ON videos FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "videos_update_own" ON videos FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "videos_delete_own" ON videos FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

CREATE POLICY "likes_read_all" ON likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert_own" ON likes FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "likes_delete_own" ON likes FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

CREATE POLICY "matches_read_participants" ON matches FOR SELECT TO authenticated USING (auth.uid()::text = founder_id OR auth.uid()::text = investor_id);
CREATE POLICY "matches_insert_participant" ON matches FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = founder_id OR auth.uid()::text = investor_id);
CREATE POLICY "matches_update_participant" ON matches FOR UPDATE TO authenticated USING (auth.uid()::text = founder_id OR auth.uid()::text = investor_id) WITH CHECK (auth.uid()::text = founder_id OR auth.uid()::text = investor_id);

CREATE POLICY "conversations_read_participants" ON conversations FOR SELECT TO authenticated USING (auth.uid()::text = user_a OR auth.uid()::text = user_b);
CREATE POLICY "conversations_insert_participant" ON conversations FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_a OR auth.uid()::text = user_b);
CREATE POLICY "conversations_update_participant" ON conversations FOR UPDATE TO authenticated USING (auth.uid()::text = user_a OR auth.uid()::text = user_b) WITH CHECK (auth.uid()::text = user_a OR auth.uid()::text = user_b);

CREATE POLICY "messages_read_participants" ON messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid()::text OR c.user_b = auth.uid()::text))
);
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid()::text OR c.user_b = auth.uid()::text)) AND auth.uid()::text = sender_id
);

CREATE POLICY "intros_read_participants" ON intros FOR SELECT TO authenticated USING (auth.uid()::text = investor_id OR auth.uid()::text = founder_id);
CREATE POLICY "intros_insert_investor" ON intros FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = investor_id);
CREATE POLICY "intros_update_participants" ON intros FOR UPDATE TO authenticated USING (auth.uid()::text = investor_id OR auth.uid()::text = founder_id) WITH CHECK (auth.uid()::text = investor_id OR auth.uid()::text = founder_id);

-- ---------- Insert sample founders ----------
INSERT INTO profiles (id, user_type, name, avatar, company, bio, stage, sector, funding_goal, traction, location, verified, created_at)
VALUES
  ('sample-founder-1', 'founder', 'Maya Okonkwo', 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Lumen Labs', 'AI code review for fast-moving teams.', 'Seed', 'AI/ML', '$3M', '12K devs, $8K MRR', 'San Francisco, CA', false, now()),
  ('sample-founder-2', 'founder', 'Diego Marín', 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Verdant', 'Carbon accounting for mid-market manufacturers.', 'Pre-seed', 'Climate', '$750K', '4 paid pilots', 'Mexico City, MX', false, now()),
  ('sample-founder-3', 'founder', 'Priya Raman', 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Kettle', 'Banking-as-a-service for creators.', 'Series A', 'Fintech', '$10M', '$1.2M ARR', 'Bengaluru, IN', false, now()),
  ('sample-founder-4', 'founder', 'Sasha Volkov', 'https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Driftwood', 'Headless commerce for niche DTC brands.', 'Seed', 'Consumer', '$4M', '40 stores, $60K GMV/mo', 'Lisbon, PT', false, now()),
  ('sample-founder-5', 'founder', 'Noah Kim', 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Forge', 'Open-source observability for serverless.', 'Pre-seed', 'Devtools', '$1M', '3.2K GitHub stars', 'Seoul, KR', false, now()),
  ('sample-founder-6', 'founder', 'Amelia Brooks', 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Cadence', 'AI care navigator for chronic patients.', 'Seed', 'Healthtech', '$5M', '2 health systems live', 'Boston, MA', false, now()),
  ('sample-founder-7', 'founder', 'Tariq Hassan', 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Souk', 'B2B marketplace for African suppliers.', 'Series A', 'Marketplaces', '$8M', '1.4K suppliers, $400K GMV', 'Lagos, NG', false, now()),
  ('sample-founder-8', 'founder', 'Lena Fischer', 'https://images.pexels.com/photos/2128807/pexels-photo-2128807.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Northwind', 'Battery management OS for fleets.', 'Pre-seed', 'Hardware', '$1.5M', '3 LOIs from fleets', 'Berlin, DE', false, now()),
  ('sample-founder-9', 'founder', 'Jules Tremblay', 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Mint Layer', 'Compliance rails for stablecoin issuers.', 'Seed', 'Web3', '$3.5M', '$14M TVL', 'Montréal, CA', false, now()),
  ('sample-founder-10', 'founder', 'Rin Watanabe', 'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Tatami', 'Private LLMs for regulated industries.', 'Series A', 'AI/ML', '$12M', '$2.1M ARR', 'Tokyo, JP', false, now())
ON CONFLICT (id) DO NOTHING;

-- ---------- Insert sample investors ----------
INSERT INTO profiles (id, user_type, name, avatar, company, bio, preferred_stages, preferred_sectors, check_size, board_style, verified, created_at)
VALUES
  ('sample-investor-1', 'investor', 'Cameron Reyes', 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Northstar Ventures', 'Early-stage AI & devtools. Lead $1–3M checks.', ARRAY['Pre-seed','Seed'], ARRAY['AI/ML','Devtools','SaaS'], '$1M–$3M', 'Hands-off, monthly updates', true, now()),
  ('sample-investor-2', 'investor', 'Jordan Blake', 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Tidewater Capital', 'Climate & hard tech. Series A lead.', ARRAY['Seed','Series A'], ARRAY['Climate','Hardware','Fintech'], '$3M–$8M', 'Active board member', true, now()),
  ('sample-investor-3', 'investor', 'Sam Okafor', 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Continuum Fund', 'Global marketplaces & fintech.', ARRAY['Series A','Series B'], ARRAY['Marketplaces','Fintech','Consumer'], '$5M–$15M', 'Strategic, ops support', true, now())
ON CONFLICT (id) DO NOTHING;

-- ---------- Insert sample videos ----------
INSERT INTO videos (id, user_id, url, poster, title, description, tags, intent, traction, stage, sector, location, likes_count, is_sample, created_at)
VALUES
  ('sample-video-1', 'sample-founder-1', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Lumen Labs — AI code review for fast-moving teams.', 'AI code review for fast-moving teams. We''re seed stage in San Francisco, raising $3M. Looking for partners who get the devtools space.', ARRAY['AI/ML','Seed','San Francisco'], ARRAY['raising','hiring'], '{"users":"12K devs","mrr":"8"}', 'Seed', 'AI/ML', 'San Francisco, CA', 120, true, now()),
  ('sample-video-2', 'sample-founder-2', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Verdant — Carbon accounting for manufacturers.', 'Carbon accounting for mid-market manufacturers. Pre-seed in Mexico City, raising $750K. 4 paid pilots with Fortune-500 customers.', ARRAY['Climate','Pre-seed','Mexico City'], ARRAY['raising','open_to_talk'], '{"users":"4 pilots","mrr":"0"}', 'Pre-seed', 'Climate', 'Mexico City, MX', 157, true, now()),
  ('sample-video-3', 'sample-founder-3', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Kettle — Banking-as-a-service for creators.', 'Banking-as-a-service for creators. Series A in Bengaluru, raising $10M. $1.2M ARR and growing 18% MoM.', ARRAY['Fintech','Series A','Bengaluru'], ARRAY['raising','hiring','open_to_talk'], '{"users":"$1.2M ARR","mrr":"120"}', 'Series A', 'Fintech', 'Bengaluru, IN', 234, true, now()),
  ('sample-video-4', 'sample-founder-4', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Driftwood — Headless commerce for niche DTC.', 'Headless commerce for niche DTC brands. Seed in Lisbon, raising $4M. 40 stores live, $60K GMV/mo.', ARRAY['Consumer','Seed','Lisbon'], ARRAY['hiring','open_to_talk'], '{"users":"40 stores","mrr":"60"}', 'Seed', 'Consumer', 'Lisbon, PT', 98, true, now()),
  ('sample-video-5', 'sample-founder-5', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Forge — Open-source observability for serverless.', 'Open-source observability for serverless. Pre-seed in Seoul, raising $1M. 3.2K GitHub stars and counting.', ARRAY['Devtools','Pre-seed','Seoul'], ARRAY['raising','open_to_talk'], '{"users":"3.2K stars","mrr":"0"}', 'Pre-seed', 'Devtools', 'Seoul, KR', 73, true, now()),
  ('sample-video-6', 'sample-founder-6', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Cadence — AI care navigator for chronic patients.', 'AI care navigator for chronic patients. Seed in Boston, raising $5M. 2 health systems live.', ARRAY['Healthtech','Seed','Boston'], ARRAY['raising','hiring'], '{"users":"2 health systems","mrr":"0"}', 'Seed', 'Healthtech', 'Boston, MA', 145, true, now()),
  ('sample-video-7', 'sample-founder-7', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Souk — B2B marketplace for African suppliers.', 'B2B marketplace for African suppliers. Series A in Lagos, raising $8M. 1.4K suppliers, $400K GMV.', ARRAY['Marketplaces','Series A','Lagos'], ARRAY['raising','hiring','open_to_talk'], '{"users":"1.4K suppliers","mrr":"40"}', 'Series A', 'Marketplaces', 'Lagos, NG', 211, true, now()),
  ('sample-video-8', 'sample-founder-8', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', 'https://images.pexels.com/photos/2128807/pexels-photo-2128807.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Northwind — Battery management OS for fleets.', 'Battery management OS for fleets. Pre-seed in Berlin, raising $1.5M. 3 LOIs from European fleets.', ARRAY['Hardware','Pre-seed','Berlin'], ARRAY['open_to_talk'], '{"users":"3 LOIs","mrr":"0"}', 'Pre-seed', 'Hardware', 'Berlin, DE', 64, true, now()),
  ('sample-video-9', 'sample-founder-9', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Mint Layer — Compliance rails for stablecoin issuers.', 'Compliance rails for stablecoin issuers. Seed in Montréal, raising $3.5M. $14M TVL.', ARRAY['Web3','Seed','Montréal'], ARRAY['raising','hiring'], '{"users":"$14M TVL","mrr":"0"}', 'Seed', 'Web3', 'Montréal, CA', 89, true, now()),
  ('sample-video-10', 'sample-founder-10', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'Tatami — Private LLMs for regulated industries.', 'Private LLMs for regulated industries. Series A in Tokyo, raising $12M. $2.1M ARR.', ARRAY['AI/ML','Series A','Tokyo'], ARRAY['raising','hiring','open_to_talk'], '{"users":"$2.1M ARR","mrr":"210"}', 'Series A', 'AI/ML', 'Tokyo, JP', 302, true, now())
ON CONFLICT (id) DO NOTHING;

-- ---------- Insert sample matches ----------
INSERT INTO matches (id, founder_id, investor_id, score, reason, status, is_sample, created_at)
VALUES
  ('sample-match-1', 'sample-founder-1', 'sample-investor-1', 94, 'Lumen Labs is an AI/devtools Seed-stage raise — squarely inside Northstar’s Pre-seed/Seed thesis. Their 12K-dev traction signals product-market fit at the stage Cameron typically leads.', 'suggested', true, now()),
  ('sample-match-2', 'sample-founder-2', 'sample-investor-2', 88, 'Verdant is a Pre-seed climate raise with paid pilots — exactly Tidewater’s Pre-seed/Seed climate focus. Hardware-light climate software fits their active board style.', 'suggested', true, now()),
  ('sample-match-3', 'sample-founder-3', 'sample-investor-3', 91, 'Kettle is a fintech Series A with $1.2M ARR — a textbook Continuum Fund lead. Cross-border (India) fintech matches their global marketplaces & fintech thesis.', 'suggested', true, now()),
  ('sample-match-4', 'sample-founder-5', 'sample-investor-1', 82, 'Forge is a devtools Pre-seed with strong OSS signal (3.2K stars). Northstar’s devtools focus and small-check Pre-seed model fit the stage and traction profile.', 'suggested', true, now()),
  ('sample-match-5', 'sample-founder-7', 'sample-investor-3', 73, 'Souk is an African marketplace Series A with $400K GMV. Continuum’s global marketplaces thesis matches; check size ($5–15M) aligns with the $8M raise.', 'suggested', true, now())
ON CONFLICT (id) DO NOTHING;

-- ---------- Insert sample conversations + messages ----------
INSERT INTO conversations (id, user_a, user_b, nda_required, created_at)
VALUES
  ('sample-conv-1', 'sample-founder-1', 'sample-investor-1', false, now() - interval '30 minutes'),
  ('sample-conv-2', 'sample-founder-2', 'sample-investor-2', true, now() - interval '3 hours'),
  ('sample-conv-3', 'sample-founder-3', 'sample-investor-3', false, now() - interval '26 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
VALUES
  ('sample-msg-1', 'sample-conv-1', 'sample-investor-1', 'Hi Maya — saw your Lumen pitch. The code-review angle is exactly what I’ve been looking for.', now() - interval '2 hours'),
  ('sample-msg-2', 'sample-conv-1', 'sample-founder-1', 'Thanks Cameron! Happy to walk you through the dev workflow.', now() - interval '100 minutes'),
  ('sample-msg-3', 'sample-conv-1', 'sample-investor-1', 'Sent you a calendar hold for Tuesday — excited to dig into Lumen.', now() - interval '30 minutes'),
  ('sample-msg-4', 'sample-conv-2', 'sample-investor-2', 'Diego — Verdant’s pilot numbers look promising. Can you share the LOIs?', now() - interval '5 hours'),
  ('sample-msg-5', 'sample-conv-2', 'sample-founder-2', 'Sure — those are under NDA. Want me to enable NDA on this thread?', now() - interval '4 hours'),
  ('sample-msg-6', 'sample-conv-2', 'sample-investor-2', 'Can you share the pilot LOIs under NDA? Want to underwrite them.', now() - interval '3 hours'),
  ('sample-msg-7', 'sample-conv-3', 'sample-investor-3', 'Love what Kettle is doing in India. Let’s talk cross-border expansion.', now() - interval '26 hours')
ON CONFLICT (id) DO NOTHING;
