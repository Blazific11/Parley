import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Conversation, Message, Profile } from "../lib/types";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";

export default function MessagesScreen() {
  const { user } = useAuth();
  const location = useLocation() as { state?: { conversationId?: string } | null };
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: c } = await supabase.from("conversations").select("*").or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order("created_at", { ascending: false });
    const cList = (c ?? []) as Conversation[];
    setConversations(cList);
    const otherIds = cList.map((x) => (x.user_a === user.id ? x.user_b : x.user_a));
    if (otherIds.length > 0) {
      const { data: p } = await supabase.from("profiles").select("*").in("id", otherIds);
      const pList = (p ?? []) as Profile[];
      setProfiles(Object.fromEntries(pList.map((x) => [x.id, x])));
    }
    setLoading(false);
  }

  async function loadMessages(c: Conversation) {
    setActive(c);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", c.id).order("created_at");
    setMessages((data ?? []) as Message[]);
  }

  async function send() {
    if (!user || !active || !draft.trim()) return;
    const { data } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: user.id, content: draft.trim() }).select("*").single();
    if (data) setMessages((prev) => [...prev, data as Message]);
    setDraft("");
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  useEffect(() => {
    const id = location.state?.conversationId;
    if (!id || !user) return;
    const c = conversations.find((x) => x.id === id);
    if (c) loadMessages(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.conversationId, conversations.length, user?.id]);

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase.from("profiles").select("*").ilike("username", `%${q.trim().toLowerCase()}%`).limit(8);
    setResults((data ?? []) as Profile[]);
    setSearching(false);
  }

  async function startChat(otherId: string) {
    if (!user || otherId === user.id) return;
    setStarting(otherId);
    try {
      const [a, b] = [user.id, otherId].sort();
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_a", a)
        .eq("user_b", b)
        .maybeSingle();
      let conversationId = (existing as { id: string } | null)?.id;
      if (!conversationId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ user_a: a, user_b: b })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = (created as { id: string }).id;
      }
      await load();
      const c = (await supabase.from("conversations").select("*").eq("id", conversationId).single()).data as Conversation | null;
      if (c) loadMessages(c);
      setQuery("");
      setResults([]);
    } finally {
      setStarting(null);
    }
  }

  if (loading) return <p className="px-5 py-8 text-muted sm:px-8">Loading…</p>;

  return (
    <div className="shell px-5 py-8 sm:px-8">
      <div className="mb-8">
        <div className="eyebrow">Messages</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Conversations</h1>
      </div>

      <div className="mb-6">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Find by username</label>
        <input className="input" placeholder="Search @username…" value={query} onChange={(e) => runSearch(e.target.value)} />
        {searching && <p className="mt-1.5 text-xs text-muted">Searching…</p>}
        {results.length > 0 && (
          <div className="mt-2 divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {results.map((p) => (
              <button key={p.id} onClick={() => startChat(p.id)} disabled={starting === p.id} className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60">
                <Avatar name={p.name} src={p.avatar} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted">@{p.username ?? "unknown"}{p.company ? ` · ${p.company}` : ""}</p>
                </div>
                <span className="ml-auto text-xs text-accent-from">{starting === p.id ? "Opening…" : "Chat"}</span>
              </button>
            ))}
          </div>
        )}
        {query.trim().length > 0 && results.length === 0 && !searching && (
          <p className="mt-2 text-xs text-muted">No users found.</p>
        )}
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="No conversations yet" hint="Find someone by their username above to start a chat." />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card divide-y divide-line">
            {conversations.map((c) => {
              const otherId = c.user_a === user?.id ? c.user_b : c.user_a;
              const other = profiles[otherId];
              return (
                <button key={c.id} className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${active?.id === c.id ? "bg-surface-2" : "hover:bg-surface-2/50"}`} onClick={() => loadMessages(c)}>
                  <Avatar name={other?.name ?? "Unknown"} src={other?.avatar} size={40} />
                  <div className="min-w-0"><p className="truncate font-medium">{other?.name ?? "Unknown"}</p><p className="truncate text-xs text-muted">{other?.username ? `@${other.username}` : (other?.company ?? "")}</p></div>
                </button>
              );
            })}
          </div>
          <div className="card flex flex-col md:col-span-2">
            {active ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: "60vh" }}>
                  {messages.map((m) => (
                    <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_id === user?.id ? "ml-auto bg-gradient-to-br from-accent-from to-accent-to text-white" : "bg-surface-2 text-white ring-1 ring-line"}`}>{m.content}</div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-line p-4">
                  <input className="input" placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                  <button className="btn-accent shrink-0" onClick={send}>Send</button>
                </div>
              </>
            ) : (<div className="grid h-full place-items-center p-6 text-muted">Select a conversation</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
