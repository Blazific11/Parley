import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Profile as ProfileType, Video } from "../lib/types";
import { USER_TYPE_LABELS } from "../lib/types";
import Avatar from "../components/Avatar";
import VideoCard from "../components/VideoCard";
import EmptyState from "../components/EmptyState";

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ProfileType>>({});
  const [busy, setBusy] = useState(false);

  async function loadVideos() {
    if (!user) return;
    const { data } = await supabase.from("videos").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setVideos((data ?? []) as Video[]);
  }

  useEffect(() => { if (profile) setForm(profile); loadVideos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id, profile?.id]);

  async function save() {
    if (!user) return;
    setBusy(true);
    await supabase.from("profiles").update(form).eq("id", user.id);
    await refreshProfile();
    setBusy(false); setEditing(false);
  }

  async function deleteVideo(videoId: string) {
    if (!user) return;
    await supabase.from("likes").delete().eq("video_id", videoId);
    await supabase.from("videos").delete().eq("id", videoId);
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
  }

  if (!user) return null;

  return (
    <div className="shell px-5 py-8 sm:px-8">
      <div className="card-ink p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-5">
            <Avatar name={profile?.name ?? "Me"} src={profile?.avatar} size={80} />
            <div>
              <div className="eyebrow">{profile ? USER_TYPE_LABELS[profile.user_type] : ""}</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{profile?.name ?? "Me"}</h1>
              <p className="text-muted">{profile?.company ?? ""}</p>
              {profile?.username && <p className="text-xs text-muted/70">@{profile.username}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile?.stage && <span className="chip-accent">{profile.stage}</span>}
                {profile?.sector && <span className="chip">{profile.sector}</span>}
                {profile?.location && <span className="chip">{profile.location}</span>}
                {profile?.verified && <span className="chip-success">Verified</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/settings" className="btn-ghost">Settings</Link>
            <button className="btn-ghost" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</button>
            <button className="btn-ghost" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
        {editing && (
          <div className="mt-8 grid gap-4 border-t border-line pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Name</label><input className="input" placeholder="Name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Username</label><input className="input" placeholder="handle (for inbox)" value={form.username ?? ""} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            </div>
            <div><label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Company</label><input className="input" placeholder="Company" value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div><label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Bio</label><textarea className="input" rows={3} placeholder="Bio" value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Stage</label><input className="input" placeholder="Seed" value={form.stage ?? ""} onChange={(e) => setForm({ ...form, stage: e.target.value })} /></div>
              <div><label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Sector</label><input className="input" placeholder="AI" value={form.sector ?? ""} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></div>
              <div><label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Location</label><input className="input" placeholder="San Francisco" value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <div><button className="btn-accent" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button></div>
          </div>
        )}
        {!editing && profile?.bio && <p className="mt-6 border-t border-line pt-6 text-sm text-muted-soft">{profile.bio}</p>}
      </div>
      <h2 className="mt-10 text-lg font-semibold">My pitches</h2>
      {videos.length === 0 ? (
        <div className="mt-3"><EmptyState title="No pitches yet" hint="Record a pitch from the feed to see it here." /></div>
      ) : (
        <div className="mt-3 grid gap-5 sm:grid-cols-2">{videos.map((v) => <VideoCard key={v.id} video={v} profile={profile} onDelete={() => deleteVideo(v.id)} />)}</div>
      )}
    </div>
  );
}
