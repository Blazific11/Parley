/*
# Parley — harden parley_set_updated_at search_path

1. Purpose
   The `parley_set_updated_at()` trigger function was defined without an explicit
   `search_path`, which Supabase's security linter flags as "Function Search Path
   Mutable". A role with CREATE permission on a schema earlier in the search_path
   could shadow built-ins (e.g. define a hostile `now()`) and have the trigger
   execute it with the function owner's privileges.

2. Fix
   Redefine the function with `SET search_path = pg_catalog, public` so the path
   is immutable for the duration of each call. `pg_catalog` is first so built-ins
   like `now()` resolve to the trusted catalog entry; `public` is second so any
   future helper in the app schema is still reachable.

   This is non-destructive: the function body and return type are unchanged.
*/

CREATE OR REPLACE FUNCTION public.parley_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
