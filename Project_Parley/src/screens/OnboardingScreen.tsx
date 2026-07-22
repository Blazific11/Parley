import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Growth"];
const SECTORS = ["AI", "Climate", "Healthcare", "Fintech", "DevTools", "Consumer", "Industrial", "Marketplaces"];

export default function OnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [stage, setStage] = useState(profile?.stage ?? "");
  const [sector, setSector] = useState(profile?.sector ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [company, setCompany] = useState(profile?.company ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.from("profiles").update({ bio, stage, sector, location, company, username: username.trim().toLowerCase() || null }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      navigate("/feed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally { setBusy(false); }
  }

  return (
    <div className="shell px-5 py-12 sm:px-8">
      <div className="card mx-auto max-w-xl p-8">
        <div className="eyebrow">Onboarding</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Tell us about you</h1>
        <p className="mt-2 text-sm text-muted">This helps us match you with the right people on Parley.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Company</label>
            <input className="input" placeholder="Company or fund" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Username</label>
            <input className="input" placeholder="your handle (for inbox)" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Bio</label>
            <textarea className="input" rows={3} placeholder="A short bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Stage</label>
              <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">Select…</option>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Sector</label>
              <select className="input" value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="">Select…</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Location</label>
            <input className="input" placeholder="City, State" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-accent mt-2 py-3" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
        </form>
      </div>
    </div>
  );
}
