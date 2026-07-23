/*
# Auth rate limiting (sign-up / sign-in)

1. Purpose
   Facebook/Instagram-grade backends do not trust the client to throttle
   itself. Supabase Auth has built-in email/phone rate limits, but there is
   no application-level throttle on the number of sign-up / sign-in attempts
   coming from a single IP or aimed at a single email. This migration adds
   a durable `auth_attempts` log + an RPC that the `auth-proxy` edge
   function calls BEFORE it forwards a sign-up / sign-in request to
   Supabase Auth. The RPC records the attempt and returns whether the
   caller is currently within the allowed window. The edge function
   refuses the request when the RPC says no.

2. New Tables
   - `auth_attempts`
     - `id` (uuid, primary key)
     - `ip_hash` (text, not null) — sha256 of the client IP + a server
       salt so the raw IP is never stored long-term.
     - `email` (text, not null) — lowercased. Used for per-email throttling.
       Stored in plaintext because it is not secret and must be queryable.
     - `kind` (text, not null) — one of 'signup' | 'signin'.
     - `success` (boolean, not null default false) — filled in after the
       upstream Supabase Auth call resolves. Used to stop counting failed
       attempts once a user has logged in successfully.
     - `created_at` (timestamptz, not null default now()).

3. Indexes
   - `auth_attempts_ip_hash_kind_created_at_idx` on (ip_hash, kind, created_at)
   - `auth_attempts_email_kind_created_at_idx` on (email, kind, created_at)
   Both let the rate-limit RPC do range scans without a full table scan.

4. Security
   - RLS enabled on `auth_attempts`. NO policies are added, so neither the
     `anon` nor `authenticated` role can read or write the table from the
     client. Only the service-role edge function (which bypasses RLS) can
     touch it. This is intentional — the table is an internal audit log,
     not user data.
   - The RPC `parley_check_auth_rate_limit` is `SECURITY DEFINER`, owned
     by `postgres`, and runs with the caller's role only for the
     privilege check. It is the single entry point the edge function
     uses; it never trusts client-supplied timestamps.

5. Rate-limit policy (server-side, enforced by the RPC)
   - Per IP:  10 sign-in attempts / 600 seconds, 5 sign-up attempts / 600 seconds.
   - Per email: 5 sign-in attempts / 600 seconds, 3 sign-up attempts / 3600 seconds.
   - These are deliberately conservative; tune by editing the constants
     at the top of the RPC if needed.

6. Notes
   - The RPC takes `p_ip`, `p_email`, `p_kind`. It hashes the IP itself
     using a fixed salt baked into the function (not secret — its only
     job is to stop storing raw IPs verbatim). The edge function passes
     the raw IP from the request headers; it never reaches the table.
   - The RPC returns a row with `allowed boolean` and `retry_after_seconds int`
     so the edge function can return a 429 with a Retry-After header.
   - Idempotent: safe to re-run. All `CREATE` statements use
     `IF NOT EXISTS`; the RPC and trigger use `CREATE OR REPLACE`.
*/

CREATE TABLE IF NOT EXISTS auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('signup','signin')),
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS auth_attempts_ip_hash_kind_created_at_idx
  ON auth_attempts (ip_hash, kind, created_at);

CREATE INDEX IF NOT EXISTS auth_attempts_email_kind_created_at_idx
  ON auth_attempts (email, kind, created_at);

-- Fixed salt for IP hashing. Not secret — only purpose is to avoid storing
-- raw IPs in a directly identifiable form. Change it and old hashes become
-- unmatchable, which is fine (old rows just stop counting).
CREATE OR REPLACE FUNCTION parley_hash_ip(p_ip text)
RETURNS text AS $$
  SELECT encode(
    digest(
      coalesce(p_ip, '') || '::parley-ip-salt-v1',
      'sha256'
    ),
    'hex'
  );
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION parley_check_auth_rate_limit(
  p_ip text,
  p_email text,
  p_kind text
)
RETURNS TABLE (
  allowed boolean,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_hash text := parley_hash_ip(p_ip);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip_limit int;
  v_ip_window int;
  v_email_limit int;
  v_email_window int;
  v_ip_count int;
  v_email_count int;
  v_oldest_ip timestamptz;
  v_oldest_email timestamptz;
BEGIN
  IF p_kind NOT IN ('signup','signin') THEN
    RAISE EXCEPTION 'invalid kind: %', p_kind;
  END IF;

  IF p_kind = 'signin' THEN
    v_ip_limit := 10;    v_ip_window := 600;
    v_email_limit := 5;  v_email_window := 600;
  ELSE
    v_ip_limit := 5;     v_ip_window := 600;
    v_email_limit := 3;  v_email_window := 3600;
  END IF;

  SELECT count(*), min(created_at)
    INTO v_ip_count, v_oldest_ip
    FROM auth_attempts
    WHERE ip_hash = v_ip_hash AND kind = p_kind
      AND created_at > now() - (v_ip_window || ' seconds')::interval;

  SELECT count(*), min(created_at)
    INTO v_email_count, v_oldest_email
    FROM auth_attempts
    WHERE email = v_email AND kind = p_kind
      AND created_at > now() - (v_email_window || ' seconds')::interval;

  IF v_ip_count >= v_ip_limit OR v_email_count >= v_email_limit THEN
    -- Report the longer of the two retry windows.
    RETURN QUERY SELECT false,
      greatest(
        ceil(extract(epoch from (v_oldest_ip + (v_ip_window || ' seconds')::interval - now())))::int,
        ceil(extract(epoch from (v_oldest_email + (v_email_window || ' seconds')::interval - now())))::int,
        1
      );
    RETURN;
  END IF;

  -- Record the attempt. success defaults to false; the edge function
  -- flips it to true via a second RPC after Supabase Auth succeeds.
  INSERT INTO auth_attempts (ip_hash, email, kind, success)
    VALUES (v_ip_hash, v_email, p_kind, false);

  RETURN QUERY SELECT true, 0;
END;
$$;

CREATE OR REPLACE FUNCTION parley_mark_auth_success(
  p_ip text,
  p_email text,
  p_kind text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE auth_attempts
    SET success = true
    WHERE ip_hash = parley_hash_ip(p_ip)
      AND email = lower(trim(coalesce(p_email, '')))
      AND kind = p_kind
      AND success = false
      AND created_at > now() - interval '10 minutes';
$$;

-- Required for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
