-- 1. Fix search_path mutable on parley_hash_ip
--    Set an immutable search_path so the function can't be hijacked
--    by a malicious schema in the caller's search path.
ALTER FUNCTION public.parley_hash_ip(text)
  SET search_path = public, pg_temp;

-- 2. Switch SECURITY DEFINER functions to SECURITY INVOKER.
--    These functions only read/write the auth_attempts table, which is
--    accessible to the service role (used by the edge function). They
--    should NOT run with elevated privileges when called by anon/authenticated.
ALTER FUNCTION public.parley_check_auth_rate_limit(text, text, text)
  SECURITY INVOKER;
ALTER FUNCTION public.parley_check_auth_rate_limit(text, text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.parley_mark_auth_success(text, text, text)
  SECURITY INVOKER;
ALTER FUNCTION public.parley_mark_auth_success(text, text, text)
  SET search_path = public, pg_temp;

-- 3. Revoke EXECUTE from anon and authenticated so these RPCs can only
--    be called via the service role key (edge function), not directly
--    from the client.
REVOKE EXECUTE ON FUNCTION public.parley_check_auth_rate_limit(text, text, text)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parley_mark_auth_success(text, text, text)
  FROM anon, authenticated;

-- 4. RLS on auth_attempts: no direct client access (anon or authenticated).
--    All access goes through the service role (edge function) which bypasses RLS.
--    Add a deny-all policy so the table is locked down even if someone
--    somehow gets execute permission on the RPCs.
CREATE POLICY "auth_attempts_no_access"
  ON auth_attempts FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
