import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Navigation from "./components/Navigation";
import LandingScreen from "./screens/LandingScreen";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import FeedScreen from "./screens/FeedScreen";
import CreatePitchScreen from "./screens/CreatePitchScreen";
import MatchScreen from "./screens/MatchScreen";
import MessagesScreen from "./screens/MessagesScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SettingsScreen from "./screens/SettingsScreen";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="px-5 py-8 text-muted sm:px-8">Loading…</p>;
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/signin" element={<AuthScreen mode="signin" />} />
        <Route path="/signup" element={<AuthScreen mode="signup" />} />
        <Route path="/onboarding" element={<Protected><OnboardingScreen /></Protected>} />
        <Route path="/feed" element={<Protected><FeedScreen /></Protected>} />
        <Route path="/create" element={<Protected><CreatePitchScreen /></Protected>} />
        <Route path="/matches" element={<Protected><MatchScreen /></Protected>} />
        <Route path="/messages" element={<Protected><MessagesScreen /></Protected>} />
        <Route path="/profile" element={<Protected><ProfileScreen /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsScreen /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
