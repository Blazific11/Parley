import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, UserType } from "./types";

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userType: UserType, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserType: (userType: UserType) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(u: User | null) {
    if (!u) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      loadProfile(data.session?.user ?? null).finally(() => mounted && setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, profile, loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password, userType, name) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      const u = data.user;
      if (u) await supabase.from("profiles").upsert({ id: u.id, user_type: userType, name });
    },
    async signOut() {
      await supabase.auth.signOut();
      setUser(null); setProfile(null);
    },
    async refreshProfile() {
      if (user) await loadProfile(user);
    },
    async updateUserType(userType) {
      if (!user) return;
      const { error } = await supabase.from("profiles").update({ user_type: userType }).eq("id", user.id);
      if (error) throw error;
      await loadProfile(user);
    },
    async deleteAccount() {
      if (!user) return;
      // Best-effort cleanup of user rows; auth user is removed by signing out.
      await supabase.from("messages").delete().eq("sender_id", user.id);
      await supabase.from("likes").delete().eq("user_id", user.id);
      await supabase.from("videos").delete().eq("user_id", user.id);
      await supabase.from("matches").delete().or(`founder_id.eq.${user.id},investor_id.eq.${user.id}`);
      await supabase.from("conversations").delete().or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      await supabase.from("profiles").delete().eq("id", user.id);
      await supabase.auth.signOut();
      setUser(null); setProfile(null);
    },
  }), [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
