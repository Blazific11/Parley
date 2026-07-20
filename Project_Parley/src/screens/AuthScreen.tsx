import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Profile } from "../lib/types";
import Logo from "../components/Logo";

type Mode = "signin" | "signup";

export default function AuthScreen({ mode }: { mode: Mode }) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [userType, setUserType] = useState<Profile["user_type"]>("founder");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password, userType, name);
      navigate("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="shell flex min-h-[80vh] items-center justify-center px-5 py-12 sm:px-8">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-2 font-semibold"><Logo size={26} className="text-accent" />Parley</div>
        <div className="eyebrow">{mode === "signin" ? "Welcome back" : "Join Parley"}</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{mode === "signin" ? "Sign in to your account" : "Create your account"}</h1>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {mode === "signup" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Name</label>
                <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">I am a</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["founder", "investor"] as const).map((t) => (
                    <button type="button" key={t} onClick={() => setUserType(t)} className={`btn ${userType === t ? "bg-white text-ink" : "bg-surface-2 text-muted ring-1 ring-line hover:text-white"}`}><span className="capitalize">{t}</span></button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Email</label>
            <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-accent mt-2 py-3" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
      </div>
    </div>
  );
}
