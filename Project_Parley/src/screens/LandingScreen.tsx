import { Link } from "react-router-dom";
import Logo from "../components/Logo";

export default function LandingScreen() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 select-none text-center font-bold leading-none text-white/[0.03]" style={{ fontSize: "clamp(8rem, 22vw, 20rem)" }}>PARLEY</div>
      <section className="shell relative z-10 px-5 py-20 sm:px-8 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="eyebrow">Independent Studio</div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
              <span className="line-mask"><span>Where founders pitch,</span></span>
              <span className="line-mask"><span>and investors reply.</span></span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-soft">Parley turns pitch videos into two-way conversations. Record once, reach the right investors, and let the data do the matching.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-accent">
                Get started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link to="/signin" className="btn-ghost">I already have an account</Link>
            </div>
            <div className="mt-10 flex items-center gap-4 border-t border-line pt-6 text-xs uppercase tracking-[0.2em] text-muted">
              <span>Working since 2024</span>
              <span className="hidden sm:inline">Remote-first, worldwide</span>
            </div>
          </div>
          <div className="relative">
            <div className="card-ink relative aspect-[4/5] overflow-hidden p-6">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted"><span>Featured pitch</span><span>2025</span></div>
                <div className="grid place-items-center py-8"><Logo size={72} className="text-accent-from" /></div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">Nimbus AI in 60 seconds</h3>
                  <p className="mt-2 text-sm text-muted-soft">On-device inference that cuts mobile latency by 70%.</p>
                  <div className="mt-4 flex flex-wrap gap-1.5"><span className="chip-accent">Seed</span><span className="chip">AI</span><span className="chip">#Mobile</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="shell relative z-10 px-5 pb-20 sm:px-8">
        <div className="card-ink grid grid-cols-2 gap-6 p-8 md:grid-cols-4 md:p-12">
          {[{ n: "200+", l: "Brands shipped" }, { n: "98%", l: "Match retention" }, { n: "12", l: "Sectors covered" }, { n: "40+", l: "Active investors" }].map((s) => (
            <div key={s.l}><div className="text-3xl font-semibold tracking-tight md:text-5xl">{s.n}</div><div className="mt-2 text-sm text-muted">{s.l}</div></div>
          ))}
        </div>
      </section>
    </div>
  );
}
