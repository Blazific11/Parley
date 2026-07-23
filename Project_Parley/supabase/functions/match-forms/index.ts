import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type FormData = {
  company?: string; sector?: string; stage?: string; location?: string;
  funding_goal?: string; check_size?: string; description?: string;
  looking_for?: string; traction?: string; team_size?: string;
  timeline?: string; additional?: string;
};

type MatchForm = {
  id: string; user_id: string; user_type: string; form_data: FormData;
  status: string; matches_result: any[] | null; created_at?: string;
};

type Profile = {
  id: string; name: string; company?: string; sector?: string;
  stage?: string; user_type: string;
};

type MatchResult = {
  matched_user_id: string; matched_form_id: string; score: number;
  reason: string; matched_name?: string; matched_company?: string;
  matched_sector?: string; matched_stage?: string;
};

function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  const stop = new Set(["the","a","an","is","are","was","were","be","been","being","and","or","but","in","on","at","to","for","of","with","by","from","as","into","about","like","through","after","over","between","out","against","during","without","before","under","around","among","it","its","this","that","these","those","i","you","he","she","we","they","me","him","her","us","them","my","your","his","our","their","what","which","who","whom","will","would","can","could","should","may","might","must","have","has","had","do","does","did","not","no","so","if","then","than","also","just","very","more","most","some","any"]);
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function sectorScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a.toLowerCase() === b.toLowerCase()) return 1;
  if (a === "Other" || b === "Other") return 0.2;
  return 0;
}

function stageScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const order = ["Pre-seed","Seed","Series A","Series B","Growth"];
  const ia = order.indexOf(a); const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return 0;
  const diff = Math.abs(ia - ib);
  if (diff === 1) return 0.7;
  if (diff === 2) return 0.3;
  return 0;
}

function locationScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim(); const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const ca = la.split(",")[0]?.trim() ?? ""; const cb = lb.split(",")[0]?.trim() ?? "";
  if (ca && cb && ca === cb) return 0.8;
  const sa = la.split(",")[1]?.trim() ?? ""; const sb = lb.split(",")[1]?.trim() ?? "";
  if (sa && sb && sa === sb) return 0.5;
  return 0;
}

function timelineScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const order = ["Immediately","1–3 months","3–6 months","6+ months"];
  const ia = order.indexOf(a); const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return 0;
  return Math.max(0, 1 - Math.abs(ia - ib) * 0.3);
}

function checkSizeCompatibility(founderGoal: string, investorCheck: string): number {
  if (!founderGoal || !investorCheck) return 0;
  const goalMatch = founderGoal.match(/\$?([\d.]+)\s*([KM]+)?/i);
  if (!goalMatch) return 0;
  let goalNum = parseFloat(goalMatch[1]);
  const unit = (goalMatch[2] ?? "").toUpperCase();
  if (unit === "K") goalNum *= 1;
  else if (unit === "M") goalNum *= 1000;
  const ranges: Record<string, [number, number]> = {
    "$25K–$100K": [25, 100], "$100K–$500K": [100, 500],
    "$500K–$2M": [500, 2000], "$2M–$10M": [2000, 10000], "$10M+": [10000, Infinity],
  };
  const range = ranges[investorCheck];
  if (!range) return 0;
  if (goalNum >= range[0] && goalNum <= range[1]) return 1;
  if (goalNum >= range[0] * 0.5 && goalNum <= range[1] * 2) return 0.5;
  return 0;
}

function textSimilarity(a: string, b: string): number {
  return jaccard(tokenize(a ?? ""), tokenize(b ?? ""));
}

function scorePair(myForm: MatchForm, theirForm: MatchForm, myProfile: Profile | null, theirProfile: Profile | null): MatchResult | null {
  const mine = myForm.form_data; const theirs = theirForm.form_data;
  const weights = { sector: 0.22, stage: 0.18, textSim: 0.20, lookingFor: 0.15, location: 0.08, timeline: 0.07, funding: 0.10 };
  const sSector = sectorScore(mine.sector ?? "", theirs.sector ?? "");
  const sStage = stageScore(mine.stage ?? "", theirs.stage ?? "");
  const sText = textSimilarity(mine.description ?? "", theirs.description ?? "");
  const sLookingFor = textSimilarity(mine.looking_for ?? "", theirs.looking_for ?? "");
  const sLocation = locationScore(mine.location ?? "", theirs.location ?? "");
  const sTimeline = timelineScore(mine.timeline ?? "", theirs.timeline ?? "");
  let sFunding = 0;
  if (myForm.user_type === "founder") sFunding = checkSizeCompatibility(mine.funding_goal ?? "", theirs.check_size ?? "");
  else sFunding = checkSizeCompatibility(theirs.funding_goal ?? "", mine.check_size ?? "");
  const score = sSector * weights.sector + sStage * weights.stage + sText * weights.textSim + sLookingFor * weights.lookingFor + sLocation * weights.location + sTimeline * weights.timeline + sFunding * weights.funding;
  const score100 = Math.round(score * 100);
  const reasons: string[] = [];
  if (sSector >= 0.8) reasons.push("Strong sector alignment in " + (mine.sector ?? ""));
  if (sStage >= 0.8) reasons.push("Stage match: " + (mine.stage ?? ""));
  if (sText >= 0.25) reasons.push("Overlapping vision and approach");
  if (sLookingFor >= 0.2) reasons.push("Complementary goals");
  if (sFunding >= 0.8) reasons.push("Funding range aligned");
  if (sLocation >= 0.8) reasons.push("Same location: " + (mine.location ?? ""));
  if (sTimeline >= 0.8) reasons.push("Timelines aligned");
  if (reasons.length === 0) {
    if (sSector > 0) reasons.push("Partial sector overlap");
    else if (sStage > 0) reasons.push("Nearby stage");
    else reasons.push("Some potential overlap");
  }
  return {
    matched_user_id: theirForm.user_id, matched_form_id: theirForm.id,
    score: score100, reason: reasons.join(" · "),
    matched_name: theirProfile?.name ?? theirs.company ?? "Unknown",
    matched_company: theirProfile?.company ?? theirs.company,
    matched_sector: theirProfile?.sector ?? theirs.sector,
    matched_stage: theirProfile?.stage ?? theirs.stage,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const body = await req.json();
    const formId: string | undefined = body?.formId;
    if (!formId) return new Response(JSON.stringify({ error: "formId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await admin.from("match_forms").update({ status: "processing" }).eq("id", formId);
    const { data: myFormRow, error: formErr } = await admin.from("match_forms").select("*").eq("id", formId).maybeSingle();
    if (formErr || !myFormRow) return new Response(JSON.stringify({ error: "form not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const myForm = myFormRow as MatchForm;
    const oppositeType = myForm.user_type === "founder" ? "investor" : "founder";
    const { data: oppositeForms } = await admin.from("match_forms").select("*").eq("user_type", oppositeType).order("created_at", { ascending: false });
    const { data: profilesData } = await admin.from("profiles").select("*");
    const profileMap = new Map<string, Profile>();
    for (const p of (profilesData ?? []) as any[]) profileMap.set(p.id, { id: p.id, name: p.name ?? "", company: p.company, sector: p.sector, stage: p.stage, user_type: p.user_type });
    const myProfile = profileMap.get(myForm.user_id) ?? null;
    const results: MatchResult[] = [];
    for (const theirFormRow of (oppositeForms ?? []) as MatchForm[]) {
      if (theirFormRow.user_id === myForm.user_id) continue;
      const theirProfile = profileMap.get(theirFormRow.user_id) ?? null;
      const result = scorePair(myForm, theirFormRow, myProfile, theirProfile);
      if (result && result.score > 0) results.push(result);
    }
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, 10);
    await admin.from("match_forms").update({ status: "processed", matches_result: topResults, updated_at: new Date().toISOString() }).eq("id", formId);
    return new Response(JSON.stringify({ success: true, matches: topResults.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
