import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Match, Profile } from "../lib/types";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";

export default function MatchScreen() {
  const { user, profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const col = profile?.user_type === "investor" ? "investor_id" : "founder_id";
    const { data: m } = await supabase.from("matches").select("*").eq(col, user.id).order("score", { ascending: false });
    const mList = (m ?? []) as Match[];
    setMatches(mList);
    const otherIds = mList.map((x) => (x.founder_id === user.id ? x.investor_id : x.founder_id));
    if (otherIds.length > 0) {
      const { data: p } = await supabase.from("profiles").select("*").in("id", otherIds);
      const pList = (p ?? []) as Profile[];
      setProfiles(Object.fromEntries(pList.map((x) => [x.id, x])));
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id, profile?.user_type]);

  async function updateStatus(id: string, status: Match["status"]) {
    await supabase.from("matches").update({ status }).eq("id", id);
    setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  if (loading) return <p className="px-5 py-8 text-muted sm:px-8">Loading…</p>;

  return (
    <div className="shell px-5 py-8 sm:px-8">
      <div className="mb-8">
        <div className="eyebrow">Matches</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="line-mask"><span>Proof in the fit,</span></span>
          <span className="line-mask"><span>not the words.</span></span>
        </h1>
      </div>
      {matches.length === 0 ? (
        <EmptyState title="No matches yet" hint="Publish a pitch or update your profile to start matching." />
      ) : (
        <div className="grid gap-3">
          {matches.map((m) => {
            const otherId = m.founder_id === user?.id ? m.investor_id : m.founder_id;
            const other = profiles[otherId];
            return (
              <div key={m.id} className="card flex items-center justify-between p-5 transition-colors hover:bg-surface-2">
                <div className="flex items-center gap-4">
                  <Avatar name={other?.name ?? "Unknown"} src={other?.avatar} size={48} />
                  <div>
                    <p className="font-semibold">{other?.name ?? "Unknown"}</p>
                    <p className="text-sm text-muted">{other?.company ?? ""}</p>
                    {m.reason && <p className="mt-0.5 text-xs text-muted/70">{m.reason}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><p className="text-2xl font-bold text-accent-from tabular-nums">{m.score}</p><p className="text-xs text-muted">fit</p></div>
                  {m.status === "suggested" && <button className="btn-accent" onClick={() => updateStatus(m.id, "requested")}>Request</button>}
                  {m.status === "requested" && <span className="chip">Requested</span>}
                  {m.status === "accepted" && <span className="chip-success">Accepted</span>}
                  {m.status === "declined" && <span className="chip">Declined</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
