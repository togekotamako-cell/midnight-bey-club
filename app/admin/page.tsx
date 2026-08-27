"use client";

import { useEffect, useMemo, useState } from "react";

type Format = "3ON3" | "TEAM";
type Status = "ENTRY OPEN" | "UPCOMING" | "FINISHED";
type Player = {
  id: string;
  name: string;
  nickname: string;
  points: number;
  wins: number;
  tournaments: number;
  user_id?: string | null;
};
type Tournament = { id: string; name: string; date: string; location: string; status: Status; format: Format };
type Result = { id: string; rank: number; player_id: string; bey1: string; bey2: string; bey3: string };
type Team = { id: string; name: string; rank: 1 | 2; members: string[] };
type Custom = { id: string; player_id: string; label: string; value: string };
type Session = { access_token: string; refresh_token?: string; user?: { id: string; email?: string } };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function headers(token?: string) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${token || KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}
async function api(path: string, init: RequestInit = {}, token?: string) {
  if (!URL || !KEY) throw new Error("SUPABASE ENVIRONMENT VARIABLES ARE MISSING.");
  return fetch(`${URL}${path}`, { ...init, headers: { ...headers(token), ...(init.headers || {}) }, cache: "no-store" });
}
const enc = (v: string) => encodeURIComponent(v);
const uid = () => crypto.randomUUID();
const dateOut = (v: unknown) => { const s = String(v ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replaceAll("-", ".") : s; };
const dateIn = (v: string) => v.replaceAll(".", "-");
const errText = (e: unknown) => e instanceof Error ? e.message : String(e);

async function refreshSession(session: Session): Promise<Session | null> {
  if (!session.refresh_token) return null;
  const r = await fetch(`${URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.access_token || !data?.user?.id) return null;
  const next = data as Session;
  localStorage.setItem("midnight_session", JSON.stringify(next));
  return next;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"tournaments" | "players">("tournaments");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [customs, setCustoms] = useState<Custom[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = tournaments.find(t => t.id === selectedId) ?? null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = localStorage.getItem("midnight_session");
        if (!raw) { if (alive) setAuthorized(false); return; }
        let s = JSON.parse(raw) as Session;
        if (!s?.access_token || !s?.user?.id) { if (alive) setAuthorized(false); return; }
        const probe = await api(`/rest/v1/accounts?select=id&id=eq.${enc(s.user.id)}&limit=1`, {}, s.access_token);
        if (probe.status === 401) {
          const refreshed = await refreshSession(s);
          if (!refreshed) { if (alive) setAuthorized(false); return; }
          s = refreshed;
        }
        if (alive) setSession(s);
      } catch (e) { if (alive) { setAuthorized(false); setMessage(errText(e)); } }
    })();
    return () => { alive = false; };
  }, []);

  const loadAll = async (s = session) => {
    if (!s?.access_token || !s.user?.id) return;
    setMessage("LOADING...");
    let account = await api(`/rest/v1/accounts?select=is_admin,player_id,display_name&id=eq.${enc(s.user.id)}&limit=1`, {}, s.access_token);
    if (account.status === 401) {
      const refreshed = await refreshSession(s);
      if (!refreshed) throw new Error("SESSION EXPIRED. PLEASE LOGIN AGAIN.");
      setSession(refreshed);
      account = await api(`/rest/v1/accounts?select=is_admin,player_id,display_name&id=eq.${enc(refreshed.user!.id)}&limit=1`, {}, refreshed.access_token);
      s = refreshed;
    }
    if (!account.ok) throw new Error(await account.text());
    const accounts = await account.json();
    if (!accounts?.[0]?.is_admin) { setAuthorized(false); setMessage("ADMIN ACCESS REQUIRED."); return; }
    setAuthorized(true);

    const [tr, pr] = await Promise.all([
      api("/rest/v1/tournaments?select=*&order=tournament_date.asc", {}, s.access_token),
      api("/rest/v1/players?select=*&order=name.asc", {}, s.access_token),
    ]);
    if (!tr.ok) throw new Error(`TOURNAMENT LOAD FAILED: ${await tr.text()}`);
    if (!pr.ok) throw new Error(`PLAYER LOAD FAILED: ${await pr.text()}`);
    const trs = await tr.json();
    const prs = await pr.json();
    setTournaments(Array.isArray(trs) ? trs.map((r: any) => ({
      id: String(r.id), name: String(r.name ?? ""), date: dateOut(r.tournament_date ?? r.date), location: String(r.location ?? ""),
      status: String(r.status ?? "UPCOMING") as Status,
      format: String(r.format ?? r.tournament_format ?? r.tournament_type ?? "3ON3").toUpperCase().includes("TEAM") ? "TEAM" : "3ON3",
    })) : []);
    setPlayers(Array.isArray(prs) ? prs.map((r: any) => ({
      id: String(r.id), name: String(r.name ?? "PLAYER"), nickname: String(r.nickname ?? ""),
      points: Number(r.points ?? 0), wins: Number(r.wins ?? 0), tournaments: Number(r.tournaments ?? 0), user_id: r.user_id ?? null,
    })) : []);
    setMessage("");
  };

  useEffect(() => { if (session) loadAll(session).catch(e => { setAuthorized(false); setMessage(errText(e)); }); }, [session]);

  const openTournament = async (id: string) => {
    setSelectedId(id); setLoadingDetail(true); setMessage("");
    try {
      const token = session?.access_token;
      const [rr, tr, cr] = await Promise.all([
        api(`/rest/v1/tournament_results?select=*&tournament_id=eq.${enc(id)}&order=rank.asc`, {}, token),
        api(`/rest/v1/teams?select=*&tournament_id=eq.${enc(id)}&order=rank.asc`, {}, token),
        api(`/rest/v1/custom_registrations?select=*&tournament_id=eq.${enc(id)}`, {}, token),
      ]);
      const rrows = rr.ok ? await rr.json() : [];
      const trows = tr.ok ? await tr.json() : [];
      const crows = cr.ok ? await cr.json() : [];
      setResults(Array.isArray(rrows) ? rrows.map((r: any) => ({
        id: String(r.id ?? uid()), rank: Number(r.rank ?? r.place ?? r.placement ?? 1), player_id: String(r.player_id ?? ""),
        bey1: String(r.bey1 ?? r.bey_1 ?? ""), bey2: String(r.bey2 ?? r.bey_2 ?? ""), bey3: String(r.bey3 ?? r.bey_3 ?? ""),
      })) : []);
      setCustoms(Array.isArray(crows) ? crows.map((r: any) => {
        const raw = r.registration_data ?? r.custom_data ?? r.custom ?? r.value ?? "";
        let label = String(r.label ?? r.name ?? r.title ?? "CUSTOM");
        let value = typeof raw === "string" ? raw : JSON.stringify(raw);
        try { const parsed = JSON.parse(value); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) { label = String((parsed as any).label ?? label); value = String((parsed as any).value ?? parsed); } } catch {}
        return { id: String(r.id ?? uid()), player_id: String(r.player_id ?? ""), label, value };
      }) : []);
      if (Array.isArray(trows)) {
        const ids = trows.map((r: any) => String(r.id)).filter(Boolean);
        let members: any[] = [];
        if (ids.length) {
          const mr = await api(`/rest/v1/team_members?select=*&team_id=in.(${ids.map(enc).join(",")})`, {}, token);
          if (mr.ok) members = await mr.json();
        }
        setTeams(trows.map((r: any) => ({
          id: String(r.id), name: String(r.name ?? r.team_name ?? "TEAM"), rank: Number(r.rank ?? r.place ?? 1) === 2 ? 2 : 1,
          members: members.filter(m => String(m.team_id ?? "") === String(r.id)).map(m => String(m.player_id ?? "")),
        })));
      } else setTeams([]);
    } catch (e) { setMessage(errText(e)); }
    finally { setLoadingDetail(false); }
  };

  const newTournament = () => {
    const id = uid();
    setTournaments(v => [...v, { id, name: "NEW MIDNIGHT BEY CLUB", date: "", location: "", status: "UPCOMING", format: "3ON3" }]);
    setSelectedId(id); setResults(emptyResults()); setTeams(emptyTeams()); setCustoms([]);
  };
  const emptyResults = (): Result[] => [1, 2, 3].map(rank => ({ id: uid(), rank, player_id: "", bey1: "", bey2: "", bey3: "" }));
  const emptyTeams = (): Team[] => [{ id: uid(), name: "TEAM 1", rank: 1, members: ["", "", ""] }, { id: uid(), name: "TEAM 2", rank: 2, members: ["", "", ""] }];
  const updateT = (field: keyof Tournament, value: string) => setTournaments(v => v.map(t => t.id === selectedId ? { ...t, [field]: value } : t));
  const addCustom = () => setCustoms(v => [...v, { id: uid(), player_id: "", label: "CUSTOM", value: "" }]);
  const addPlayer = () => {
    const p: Player = { id: uid(), name: "NEW PLAYER", nickname: "", points: 0, wins: 0, tournaments: 0 };
    setPlayers(v => [...v, p]);
    setTab("players");
  };

  const saveTournament = async () => {
    if (!session?.access_token || !selected) return;
    setSaving(true); setMessage("SAVING...");
    try {
      const token = session.access_token;
      const tournamentBody = { name: selected.name, tournament_date: dateIn(selected.date), location: selected.location, status: selected.status, format: selected.format };
      let r = await api(`/rest/v1/tournaments?id=eq.${enc(selected.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(tournamentBody) }, token);
      if (!r.ok) {
        r = await api("/rest/v1/tournaments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: selected.id, ...tournamentBody }) }, token);
        if (!r.ok) throw new Error(`TOURNAMENT SAVE FAILED: ${await r.text()}`);
      }

      const oldR = await api(`/rest/v1/tournament_results?tournament_id=eq.${enc(selected.id)}&select=id`, {}, token);
      if (oldR.ok) for (const row of await oldR.json()) await api(`/rest/v1/tournament_results?id=eq.${enc(String(row.id))}`, { method: "DELETE" }, token);
      for (const x of results.filter(v => v.player_id)) {
        const p = players.find(v => v.id === x.player_id);
        const body = { id: uid(), tournament_id: selected.id, player_id: x.player_id, rank: x.rank, place: x.rank, placement: x.rank,
          player_name: p?.nickname || p?.name || "PLAYER", bey1: x.bey1, bey2: x.bey2, bey3: x.bey3, bey_1: x.bey1, bey_2: x.bey2, bey_3: x.bey3,
          points: x.rank === 1 ? 3 : x.rank === 2 ? 2 : 1 };
        const xres = await api("/rest/v1/tournament_results", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) }, token);
        if (!xres.ok) throw new Error(`3ON3 SAVE FAILED: ${await xres.text()}`);
      }

      const oldT = await api(`/rest/v1/teams?tournament_id=eq.${enc(selected.id)}&select=id`, {}, token);
      if (oldT.ok) {
        const oldTeams = await oldT.json();
        for (const row of oldTeams) {
          await api(`/rest/v1/team_members?team_id=eq.${enc(String(row.id))}`, { method: "DELETE" }, token);
          const dr = await api(`/rest/v1/teams?id=eq.${enc(String(row.id))}`, { method: "DELETE" }, token);
          if (!dr.ok) throw new Error(`TEAM DELETE FAILED: ${await dr.text()}`);
        }
      }
      for (const team of teams.filter(t => t.name.trim() || t.members.some(Boolean))) {
        const tid = uid();
        const tr = await api("/rest/v1/teams", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: tid, tournament_id: selected.id, name: team.name, team_name: team.name, rank: team.rank, place: team.rank, placement: team.rank, points: team.rank === 1 ? 2 : 1 }) }, token);
        if (!tr.ok) throw new Error(`TEAM SAVE FAILED: ${await tr.text()}`);
        for (const pid of team.members.filter(Boolean)) {
          const mr = await api("/rest/v1/team_members", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), team_id: tid, player_id: pid }) }, token);
          if (!mr.ok) throw new Error(`TEAM MEMBER SAVE FAILED: ${await mr.text()}`);
        }
      }

      const oldC = await api(`/rest/v1/custom_registrations?tournament_id=eq.${enc(selected.id)}&select=id`, {}, token);
      if (oldC.ok) for (const row of await oldC.json()) await api(`/rest/v1/custom_registrations?id=eq.${enc(String(row.id))}`, { method: "DELETE" }, token);
      for (const c of customs.filter(v => v.label.trim() || v.value.trim() || v.player_id)) {
        const data = { label: c.label, value: c.value };
        const cr = await api("/rest/v1/custom_registrations", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), tournament_id: selected.id, player_id: c.player_id || null, registration_data: data }) }, token);
        if (!cr.ok) throw new Error(`CUSTOM SAVE FAILED: ${await cr.text()}`);
      }

      await loadAll(session);
      await openTournament(selected.id);
      setMessage("SAVED: 3ON3 + TEAM BATTLE + CUSTOM.");
    } catch (e) { setMessage(errText(e)); }
    finally { setSaving(false); }
  };

  const savePlayers = async () => {
    if (!session?.access_token) return;
    setSaving(true); setMessage("SAVING PLAYERS...");
    try {
      for (const p of players) {
        const body = { name: p.name.trim() || "PLAYER", nickname: p.nickname.trim() || null, points: Math.max(0, Math.floor(Number(p.points) || 0)) };
        const r = await api(`/rest/v1/players?id=eq.${enc(p.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) }, session.access_token);
        if (!r.ok) throw new Error(`PLAYER SAVE FAILED: ${await r.text()}`);
      }
      await loadAll(session);
      setMessage("PLAYERS / POINTS SAVED.");
    } catch (e) { setMessage(errText(e)); }
    finally { setSaving(false); }
  };

  const createPlayer = async () => {
    if (!session?.access_token) return;
    setSaving(true); setMessage("CREATING PLAYER...");
    try {
      const name = `PLAYER ${String(players.length + 1).padStart(2, "0")}`;
      const r = await api("/rest/v1/players", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), name, nickname: name, points: 0, wins: 0, tournaments: 0, is_active: true }) }, session.access_token);
      if (!r.ok) throw new Error(`PLAYER CREATE FAILED: ${await r.text()}`);
      await loadAll(session); setMessage("PLAYER CREATED.");
    } catch (e) { setMessage(errText(e)); }
    finally { setSaving(false); }
  };

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)), [players]);

  if (authorized === false) return <main className="admin"><div className="gate"><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>{message || "ADMIN ACCESS REQUIRED."}</p><a href="/" className="back">BACK TO SITE ↗</a></div><style jsx global>{styles}</style></main>;
  if (authorized === null) return <main className="admin"><div className="gate"><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>CHECKING ACCESS...</p></div><style jsx global>{styles}</style></main>;

  return <main className="admin">
    <header className="adminHeader"><div><div className="eyebrow">MIDNIGHT BEY CLUB</div><h1>ADMIN</h1><p>TOURNAMENT / PLAYER / POINT MANAGEMENT</p></div><a href="/" className="back">BACK TO SITE ↗</a></header>
    <nav className="tabs">
      <button className={tab === "tournaments" ? "active" : ""} onClick={() => setTab("tournaments")}>TOURNAMENTS</button>
      <button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>PLAYERS / RANKING</button>
      <button className="new" onClick={newTournament}>+ NEW TOURNAMENT</button>
    </nav>

    {tab === "tournaments" && <div className="workspace">
      <aside className="list"><div className="listHead"><span>EVENTS</span><strong>{tournaments.length}</strong></div>
        {tournaments.length === 0 ? <div className="empty">NO DATA</div> : tournaments.map(t => <button key={t.id} className={t.id === selectedId ? "event active" : "event"} onClick={() => openTournament(t.id)}><span>{t.status}</span><strong>{t.name || "NO DATA"}</strong><small>{t.date || "NO DATE"} · {t.location || "NO LOCATION"}</small><em>{t.format}</em></button>)}
      </aside>
      <section className="editor">{!selected ? <div className="empty big">SELECT A TOURNAMENT<br />OR CREATE A NEW ONE</div> : <>
        <div className="editorHead"><div><span className="eyebrow">TOURNAMENT EDITOR</span><h2>{selected.name || "NEW TOURNAMENT"}</h2></div><span className="formatBadge">BOTH EDITORS ACTIVE</span></div>
        <div className="grid three"><Field label="TOURNAMENT NAME"><input value={selected.name} onChange={e => updateT("name", e.target.value)} /></Field><Field label="DATE"><input value={selected.date} placeholder="2026.09.12" onChange={e => updateT("date", e.target.value)} /></Field><Field label="LOCATION"><input value={selected.location} onChange={e => updateT("location", e.target.value)} /></Field></div>
        <div className="grid two"><Field label="PRIMARY DISPLAY FORMAT"><select value={selected.format} onChange={e => updateT("format", e.target.value)}><option value="3ON3">3ON3 / INDIVIDUAL</option><option value="TEAM">TEAM BATTLE</option></select></Field><Field label="STATUS"><select value={selected.status} onChange={e => updateT("status", e.target.value as Status)}><option>ENTRY OPEN</option><option>UPCOMING</option><option>FINISHED</option></select></Field></div>

        <section className="resultSection"><div className="sectionTitle"><span>RESULT 01</span><h3>3ON3 / INDIVIDUAL TOP 3</h3><p>ALWAYS EDITABLE · 1ST 3PT / 2ND 2PT / 3RD 1PT · THREE BEYS</p></div>
          {results.map(r => <div className="resultRow" key={r.id}><div className="place">{r.rank}<small>{r.rank === 1 ? "3 PT" : r.rank === 2 ? "2 PT" : "1 PT"}</small></div><Field label="PLAYER"><select value={r.player_id} onChange={e => setResults(v => v.map(x => x.id === r.id ? { ...x, player_id: e.target.value } : x))}><option value="">SELECT PLAYER</option>{players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}</select></Field>{(["bey1", "bey2", "bey3"] as const).map((k, i) => <Field key={k} label={`BEY ${i + 1}`}><input value={r[k]} onChange={e => setResults(v => v.map(x => x.id === r.id ? { ...x, [k]: e.target.value } : x))} /></Field>)}</div>)}
        </section>

        <section className="resultSection"><div className="sectionTitle"><span>RESULT 02</span><h3>TEAM BATTLE</h3><p>ALWAYS EDITABLE · 1ST TEAM 2PT EACH / 2ND TEAM 1PT EACH · 3 MEMBERS</p></div>
          {teams.map(team => <div className="teamEditor" key={team.id}><div className="teamTop"><strong>{team.rank === 1 ? "1ST PLACE" : "2ND PLACE"}</strong><select value={team.rank} onChange={e => setTeams(v => v.map(x => x.id === team.id ? { ...x, rank: Number(e.target.value) === 2 ? 2 : 1 } : x))}><option value="1">1ST</option><option value="2">2ND</option></select><input value={team.name} onChange={e => setTeams(v => v.map(x => x.id === team.id ? { ...x, name: e.target.value } : x))} /></div><div className="members">{team.members.map((m, i) => <select key={i} value={m} onChange={e => setTeams(v => v.map(x => x.id === team.id ? { ...x, members: x.members.map((z, j) => j === i ? e.target.value : z) } : x))}><option value="">MEMBER {i + 1}</option>{players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}</select>)}</div></div>)}
        </section>

        <section className="resultSection"><div className="sectionTitle"><span>EXTRA DATA</span><h3>CUSTOM</h3><p>OPTIONAL DATA SAVED WITH THE TOURNAMENT</p></div>
          {customs.map(c => <div className="customRow" key={c.id}><select value={c.player_id} onChange={e => setCustoms(v => v.map(x => x.id === c.id ? { ...x, player_id: e.target.value } : x))}><option value="">GENERAL</option>{players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}</select><input value={c.label} placeholder="LABEL" onChange={e => setCustoms(v => v.map(x => x.id === c.id ? { ...x, label: e.target.value } : x))} /><input value={c.value} placeholder="VALUE" onChange={e => setCustoms(v => v.map(x => x.id === c.id ? { ...x, value: e.target.value } : x))} /></div>)}
          <button className="add" onClick={addCustom}>+ ADD CUSTOM FIELD</button>
        </section>
        <div className="saveBar"><span className={message.includes("FAILED") || message.includes("ERROR") ? "error" : "ok"}>{loadingDetail ? "LOADING..." : message}</span><button className="save" onClick={saveTournament} disabled={saving}>{saving ? "SAVING..." : "SAVE TO DATABASE"}</button></div>
      </>}</section>
    </div>}

    {tab === "players" && <section className="panel"><div className="panelTop"><div className="sectionTitle"><span>THE NUMBERS</span><h2>PLAYERS / RANKING</h2><p>EDIT NAME / NICKNAME / CUMULATIVE POINTS</p></div><button className="addPlayer" onClick={createPlayer} disabled={saving}>+ ADD PLAYER</button></div>
      {sortedPlayers.length === 0 ? <div className="empty">NO PLAYERS</div> : <div className="playerList"><div className="player head"><div>RANK</div><div>PLAYER</div><div>NICKNAME</div><div>POINTS</div><div>WINS</div><div>EVENTS</div></div>{sortedPlayers.map((p, i) => <div className="player" key={p.id}><div className="rank">{String(i + 1).padStart(2, "0")}</div><div><label>PLAYER</label><input value={p.name} onChange={e => setPlayers(v => v.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} /></div><div><label>NICKNAME</label><input value={p.nickname} onChange={e => setPlayers(v => v.map(x => x.id === p.id ? { ...x, nickname: e.target.value } : x))} /></div><div><label>EDIT POINTS</label><input className="pointsInput" type="number" min="0" step="1" value={p.points} onChange={e => setPlayers(v => v.map(x => x.id === p.id ? { ...x, points: Math.max(0, Number(e.target.value) || 0) } : x))} /></div><div className="stat"><span>WINS</span><strong>{p.wins}</strong></div><div className="stat"><span>EVENTS</span><strong>{p.tournaments}</strong></div></div>)}</div>}
      <div className="saveArea"><span className="saved">AUTO: 3 / 2 / 1 · TEAM: 2 / 1 · MANUAL POINTS EDITABLE</span><button className="save" onClick={savePlayers} disabled={saving}>{saving ? "SAVING..." : "SAVE PLAYERS / POINTS"}</button></div>
    </section>}
    <style jsx global>{styles}</style>
  </main>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field">{label}{children}</label>; }

const styles = `
*{box-sizing:border-box}html,body{margin:0;background:#08060d;color:#f4f1f8;font-family:Arial,Helvetica,sans-serif}button,input,select{font:inherit}.admin{min-height:100vh;padding:55px 5vw;background:radial-gradient(circle at 75% 0,rgba(111,55,190,.16),transparent 34%),#08060d}.adminHeader{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #292331;padding-bottom:30px}.eyebrow,.sectionTitle span{font-size:10px;letter-spacing:4px;color:#a99ab9}.adminHeader h1{font-size:72px;line-height:.9;margin:12px 0 8px;letter-spacing:-4px}.adminHeader p{margin:0;color:#8d8398;font-size:10px;letter-spacing:3px}.back{color:#f4f1f8;text-decoration:none;border:1px solid #40364d;padding:14px 18px;font-size:10px;letter-spacing:2px}.tabs{display:flex;gap:10px;margin:28px 0}.tabs button{border:1px solid #292331;background:#0d0a12;color:#8d8398;padding:13px 18px;font-size:10px;letter-spacing:2px;cursor:pointer}.tabs button.active{color:#fff;border-color:#9d6cff;background:#171020}.tabs .new{margin-left:auto;color:#fff;border-color:#9d6cff}.workspace{display:grid;grid-template-columns:310px 1fr;gap:18px}.list,.editor,.panel{border:1px solid #292331;background:#0c0912}.list{padding:16px;align-self:start}.listHead{display:flex;justify-content:space-between;padding:10px 8px 16px;color:#77717f;font-size:10px;letter-spacing:3px}.listHead strong{color:#9d6cff}.event{position:relative;width:100%;text-align:left;background:transparent;border:1px solid transparent;border-bottom-color:#292331;color:#fff;padding:18px 12px;cursor:pointer}.event.active{background:#171020;border-color:#9d6cff}.event span{display:block;color:#77717f;font-size:8px;letter-spacing:2px}.event strong{display:block;margin:8px 0 5px;font-size:13px}.event small{color:#77717f;font-size:9px}.event em{position:absolute;right:12px;top:18px;color:#9d6cff;font-size:8px;font-style:normal;letter-spacing:1px}.editor{padding:34px}.editorHead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #292331;padding-bottom:25px;margin-bottom:25px}.editorHead h2{font-size:34px;margin:10px 0 0;letter-spacing:-1px}.formatBadge{border:1px solid #9d6cff;color:#c9b6ff;padding:10px 12px;font-size:9px;letter-spacing:2px}.grid{display:grid;gap:14px;margin-bottom:4px}.grid.three{grid-template-columns:2fr 1fr 1fr}.grid.two{grid-template-columns:1fr 1fr}.field{display:block;color:#80758e;font-size:9px;letter-spacing:2px;margin-bottom:14px}.field input,.field select,.customRow input,.customRow select,.teamTop input,.teamTop select,.members select,.pointsInput{display:block;width:100%;margin-top:7px;background:#08060d;border:1px solid #342b40;color:#fff;padding:12px;outline:0}.field input:focus,.field select:focus,input:focus,select:focus{border-color:#9d6cff}.resultSection{border-top:1px solid #292331;padding-top:30px;margin-top:30px}.sectionTitle h3{margin:8px 0 5px;font-size:27px}.sectionTitle h2{margin:8px 0 5px;font-size:42px}.sectionTitle p{margin:0 0 18px;color:#665d70;font-size:9px;letter-spacing:2px}.resultRow{display:grid;grid-template-columns:65px 1.3fr 1fr 1fr 1fr;gap:10px;align-items:end;border-bottom:1px solid #201b27;padding:18px 0}.place{font-size:26px;color:#9d6cff;padding-bottom:18px}.place small{display:block;font-size:8px;color:#77717f;letter-spacing:1px;margin-top:3px}.add{border:1px dashed #493b55;background:transparent;color:#9d6cff;padding:13px 17px;margin-top:15px;cursor:pointer;font-size:9px;letter-spacing:2px}.teamEditor{border:1px solid #292331;padding:18px;margin-bottom:12px}.teamTop{display:grid;grid-template-columns:100px 80px 1fr;gap:10px;align-items:center}.teamTop strong{color:#9d6cff;font-size:11px;letter-spacing:1px}.members{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.customRow{display:grid;grid-template-columns:180px 180px 1fr;gap:10px;margin-bottom:10px}.saveBar,.saveArea{display:flex;justify-content:flex-end;align-items:center;gap:18px;margin-top:30px}.ok,.saved{color:#9d6cff;font-size:10px;letter-spacing:2px}.error{color:#ff6b81;font-size:10px;letter-spacing:1px;max-width:70%}.save,.addPlayer{border:0;background:#f4f1f8;color:#08060d;padding:14px 22px;font-weight:700;font-size:10px;letter-spacing:2px;cursor:pointer}.save:hover,.addPlayer:hover{background:#9d6cff;color:#fff}.save:disabled,.addPlayer:disabled{opacity:.5}.panel{padding:35px}.panelTop{display:flex;justify-content:space-between;align-items:flex-end}.playerList{border-top:1px solid #292331}.player{display:grid;grid-template-columns:60px 2fr 2fr 130px 90px 90px;gap:14px;align-items:end;border-bottom:1px solid #292331;padding:18px 0}.player.head{align-items:center;padding:12px 0;color:#5f576b;font-size:8px;letter-spacing:2px}.player label{display:block;color:#80758e;font-size:8px;letter-spacing:2px}.rank{font-size:24px;color:#9d6cff;padding-bottom:15px}.stat{text-align:center;padding-bottom:14px}.stat span{display:block;color:#5f576b;font-size:8px;letter-spacing:2px}.stat strong{font-size:19px}.pointsInput{font-weight:800;color:#c29cff}.empty,.gate{min-height:250px;display:grid;place-items:center;align-content:center;gap:15px;color:#77717f;text-align:center;letter-spacing:3px}.empty.big{min-height:500px}.gate h1{margin:0;font-size:65px}.gate p{font-size:10px}@media(max-width:1000px){.workspace{grid-template-columns:1fr}.grid.three,.grid.two,.resultRow,.members,.player,.customRow,.teamTop{grid-template-columns:1fr}.admin{padding:35px 18px}.adminHeader,.panelTop{display:block}.tabs{flex-wrap:wrap}.tabs .new{margin-left:0}.editor{padding:22px}.saveBar,.saveArea{display:block}.save{margin-top:15px}.player.head{display:none}}
`;
