import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Avatar from "./Avatar";
import Logo from "./Logo";

export default function Navigation() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors hover:text-white ${isActive ? "text-white" : "text-muted"}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl">
      <div className="shell flex items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight transition-transform hover:scale-[1.03]">
          <Logo size={26} className="text-accent" />
          <span className="text-lg">Parley</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-6">
            <nav className="hidden gap-6 sm:flex">
              <NavLink to="/feed" className={linkClass}>Feed</NavLink>
              <NavLink to="/matches" className={linkClass}>Matches</NavLink>
              <NavLink to="/messages" className={linkClass}>Messages</NavLink>
              <NavLink to="/profile" className={linkClass}>Profile</NavLink>
              <NavLink to="/settings" className={linkClass}>Settings</NavLink>
            </nav>
            <Link to="/profile" className="hidden sm:block">
              <Avatar name={profile?.name ?? "Me"} src={profile?.avatar} size={34} />
            </Link>
            <button className="btn-ghost" onClick={async () => { await signOut(); navigate("/"); }}>Sign out</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link to="/signin" className="btn-ghost">Sign in</Link>
            <Link to="/signup" className="btn-primary">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  );
}
