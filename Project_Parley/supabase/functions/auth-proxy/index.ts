import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Body =
  | { kind: "signup"; email: string; password: string; userType: string; name: string }
  | { kind: "signin"; email: string; password: string };

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  if (first) return first;
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body || (body.kind !== "signup" && body.kind !== "signin")) {
      return new Response(JSON.stringify({ error: "invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: "email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = clientIp(req);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: gate, error: gateErr } = await admin.rpc("parley_check_auth_rate_limit", {
      p_ip: ip,
      p_email: body.email,
      p_kind: body.kind,
    });
    if (gateErr) {
      return new Response(JSON.stringify({ error: "rate limit check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!gate?.allowed) {
      return new Response(
        JSON.stringify({
          error: "too_many_attempts",
          retry_after_seconds: gate?.retry_after_seconds ?? 60,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(gate?.retry_after_seconds ?? 60),
          },
        },
      );
    }

    const anonKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.kind === "signup") {
      const { data, error } = await userClient.auth.signUp({
        email: body.email,
        password: body.password,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (data.user) {
        const { error: profileErr } = await admin.from("profiles").upsert({
          id: data.user.id,
          user_type: body.userType,
          name: body.name,
        });
        if (profileErr) {
          console.warn("profile upsert failed:", profileErr.message);
        }
      }
      await admin.rpc("parley_mark_auth_success", {
        p_ip: ip, p_email: body.email, p_kind: body.kind,
      });
      return new Response(
        JSON.stringify({ session: data.session, user: data.user }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // signin
    const { data, error } = await userClient.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await admin.rpc("parley_mark_auth_success", {
      p_ip: ip, p_email: body.email, p_kind: body.kind,
    });
    return new Response(
      JSON.stringify({ session: data.session, user: data.user }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
