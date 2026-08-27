"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "ENTRY OPEN" | "UPCOMING" | "FINISHED";
type Player = { id: string; name: string; nickname: string; points: number };
type Tournament = { id: string; name: string; date: string; location: string; status: Status; format: "3ON3" | "TEAM" };
type Result = { id: string; rank: 1 | 2 | 3; player_id: string; bey1: string; bey2: string; bey3: string };
type Team = { id: string; rank: 1 | 2; name: string; members: string[] };
type Custom = { id: string; label: string; value: string };
type Session = { access_token: string; refresh_token?: string; user?: { id: string; email?: string } };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function headers(token?: string) {
  return { apikey: KEY, Authorization: `Bearer ${token || KEY}`, "Content-Type": "application/json", Accept: "application/json" };
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

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"tournaments" | "players">("tournaments");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [customs, setCustoms] = useState<Custom[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = tournaments.find(t => t.id === selectedId) ?? null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("midnight_session");
      if (!raw) return setAuthorized(false);
      const s = JSON.parse(raw) as Session;
      if (!s?.access_token || !s?.user?.id) return setAuthorized(false);
      setSession(s);
    } catch { setAuthorized(false); }
  }, []);

  const loadAll = async () => {
    if (!session?.access_token || !session.user?.id) return;
    setLoading(true);
    try {
      const a = await api(`/rest/v1/accounts?select=is_admin,player_id,display_name&id=eq.${enc(session.user.id)}&limit=1`, {}, session.access_token);
      if (!a.ok) throw new Error(await a.text());
      const accountRows = await a.json();
      if (!accountRows?.[0]?.is_admin) { setAuthorized(false); setMessage("ADMIN ACCESS REQUIRED."); return; }
      setAuthorized(true);

      const [tr, pr] = await Promise.all([
        api("/rest/v1/tournaments?select=id,name,tournament_date,location,status,format&order=tournament_date.asc", {}, session.access_token),
        api("/rest/v1/players?select=id,name,nickname,points&order=name.asc", {}, session.access_token),
      ]);
      if (!tr.ok) throw new Error(await tr.text());
      if (!pr.ok) throw new Error(await pr.text());
      const trRows = await tr.json();
      const prRows = await pr.json();
      setTournaments(Array.isArray(trRows) ? trRows.map((r: any) => ({
        id: String(r.id), name: String(r.name ?? ""), date: dateOut(r.tournament_date), location: String(r.location ?? ""),
        status: String(r.status ?? "UPCOMING") as Status, format: String(r.format ?? "3ON3").toUpperCase().includes("TEAM") ? "TEAM" : "3ON3",
      })) : []);
      setPlayers(Array.isArray(prRows) ? prRows.map((r: any) => ({ id: String(r.id), name: String(r.name ?? "PLAYER"), nickname: String(r.nickname ?? ""), points: Number(r.points ?? 0) })) : []);
      setMessage("");
    } catch (e) {
      setAuthorized(false);
      setMessage(errText(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { if (session) loadAll(); }, [session]);

  const openTournament = async (id: string) => {
    setSelectedId(id); setLoading(true); setMessage("");
    try {
      const [rr, tr, cr] = await Promise.all([
        api(`/rest/v1/tournament_results?select=*&tournament_id=eq.${enc(id)}&order=placement.asc`, {}, session?.access_token),
        api(`/rest/v1/teams?select=*&tournament_id=eq.${enc(id)}&order=placement.asc`, {}, session?.access_token),
        api(`/rest/v1/custom_registrations?select=*&tournament_id=eq.${enc(id)}`, {}, session?.access_token),
      ]);
      const r = rr.ok ? await rr.json() : [];
      const t = tr.ok ? await tr.json() : [];
      const c = cr.ok ? await cr.json() : [];
      setResults(Array.isArray(r) ? r.map((x: any, i: number) => ({
        id: String(x.id ?? uid()), rank: Number(x.rank ?? x.placement ?? i + 1) === 2 ? 2 : Number(x.rank ?? x.placement ?? i + 1) === 3 ? 3 : 1,
        player_id: String(x.player_id ?? ""), bey1: String(x.bey1 ?? x.custom_name ?? ""), bey2: String(x.bey2 ?? x.custom_blade ?? ""), bey3: String(x.bey3 ?? x.custom_assist ?? ""),
      })) : []);
      const teams0 = Array.isArray(t) ? t : [];
      const ids = teams0.map((x: any) => String(x.id)).filter(Boolean);
      let members: any[] = [];
      if (ids.length) {
        const mr = await api(`/rest/v1/team_members?select=*&team_id=in.(${ids.map(enc).join(",")})`, {}, session?.access_token);
        if (mr.ok) members = await mr.json();
      }
      setTeams(teams0.map((x: any, i: number) => ({
        id: String(x.id ?? uid()), rank: Number(x.rank ?? x.placement ?? i + 1) === 2 ? 2 : 1, name: String(x.name ?? "TEAM " + (i + 1)),
        members: [0,1,2].map(j => String(members.filter(m => String(m.team_id) === String(x.id))[j]?.player_id ?? "")),
      })));
      setCustoms(Array.isArray(c) ? c.map((x: any) => ({ id: String(x.id ?? uid()), label: String(x.label ?? x.name ?? "CUSTOM"), value: String(x.value ?? x.custom_data ?? x.custom ?? "") })) : []);
    } catch (e) { setMessage(errText(e)); }
    finally { setLoading(false); }
  };

  const newTournament = () => {
    const id = uid();
    setTournaments(v => [...v, { id, name: "NEW MIDNIGHT BEY CLUB", date: "", location: "", status: "UPCOMING", format: "3ON3" }]);
    setSelectedId(id);
    setResults([{ id: uid(), rank: 1, player_id: "", bey1: "", bey2: "", bey3: "" }, { id: uid(), rank: 2, player_id: "", bey1: "", bey2: "", bey3: "" }, { id: uid(), rank: 3, player_id: "", bey1: "", bey2: "", bey3: "" }]);
    setTeams([{ id: uid(), rank: 1, name: "TEAM 1", members: ["","",""] }, { id: uid(), rank: 2, name: "TEAM 2", members: ["","",""] }]);
    setCustoms([]);
  };

  const updateT = (field: keyof Tournament, value: string) => setTournaments(v => v.map(t => t.id === selectedId ? { ...t, [field]: value } as Tournament : t));
  const addCustom = () => setCustoms(v => [...v, { id: uid(), label: "CUSTOM", value: "" }]);
  const addPlayer = () => setPlayers(v => [...v, { id: uid(), name: "NEW PLAYER", nickname: "", points: 0 }]);

  const saveTournament = async () => {
    if (!session?.access_token || !selected) return;
    setSaving(true); setMessage("SAVING...");
    try {
      const body = { name: selected.name, tournament_date: dateIn(selected.date), location: selected.location, status: selected.status, format: selected.format, is_visible: true };
      let r = await api(`/rest/v1/tournaments?id=eq.${enc(selected.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) }, session.access_token);
      if (!r.ok) r = await api("/rest/v1/tournaments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: selected.id, ...body }) }, session.access_token);
      if (!r.ok) throw new Error(`TOURNAMENT SAVE FAILED: ${await r.text()}`);

      const oldR = await api(`/rest/v1/tournament_results?tournament_id=eq.${enc(selected.id)}`, {}, session.access_token);
      if (oldR.ok) for (const x of await oldR.json()) if (x.id) {
        const d = await api(`/rest/v1/tournament_results?id=eq.${enc(String(x.id))}`, { method: "DELETE" }, session.access_token);
        if (!d.ok) throw new Error(`RESULT DELETE FAILED: ${await d.text()}`);
      }
      for (const x of results.filter(x => x.player_id)) {
        const p = players.find(y => y.id === x.player_id);
        const points = x.rank === 1 ? 3 : x.rank === 2 ? 2 : 1;
        const row = { id: uid(), tournament_id: selected.id, player_id: x.player_id, rank: x.rank, placement: x.rank, points, player_name: p?.nickname || p?.name || "PLAYER", bey1: x.bey1, bey2: x.bey2, bey3: x.bey3,
          custom_name: x.bey1, custom_blade: x.bey2, custom_assist: x.bey3 };
        const q = await api("/rest/v1/tournament_results", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) }, session.access_token);
        if (!q.ok) throw new Error(`RESULT SAVE FAILED: ${await q.text()}`);
      }

      const oldT = await api(`/rest/v1/teams?tournament_id=eq.${enc(selected.id)}`, {}, session.access_token);
      if (oldT.ok) for (const x of await oldT.json()) if (x.id) {
        const d1 = await api(`/rest/v1/team_members?team_id=eq.${enc(String(x.id))}`, { method: "DELETE" }, session.access_token);
        if (!d1.ok) throw new Error(`TEAM MEMBER DELETE FAILED: ${await d1.text()}`);
        const d2 = await api(`/rest/v1/teams?id=eq.${enc(String(x.id))}`, { method: "DELETE" }, session.access_token);
        if (!d2.ok) throw new Error(`TEAM DELETE FAILED: ${await d2.text()}`);
      }
      for (const team of teams.filter(x => x.name.trim() || x.members.some(Boolean))) {
        const tid = uid();
        const q = await api("/rest/v1/teams", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: tid, tournament_id: selected.id, name: team.name, rank: team.rank, placement: team.rank, points: team.rank === 1 ? 2 : 1 }) }, session.access_token);
        if (!q.ok) throw new Error(`TEAM SAVE FAILED: ${await q.text()}`);
        for (const pid of team.members.filter(Boolean)) {
          const m = await api("/rest/v1/team_members", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), team_id: tid, player_id: pid }) }, session.access_token);
          if (!m.ok) throw new Error(`TEAM MEMBER SAVE FAILED: ${await m.text()}`);
        }
      }

      const oldC = await api(`/rest/v1/custom_registrations?tournament_id=eq.${enc(selected.id)}`, {}, session.access_token);
      if (oldC.ok) for (const x of await oldC.json()) if (x.id) {
        const d = await api(`/rest/v1/custom_registrations?id=eq.${enc(String(x.id))}`, { method: "DELETE" }, session.access_token);
        if (!d.ok) throw new Error(`CUSTOM DELETE FAILED: ${await d.text()}`);
      }
      for (const c of customs.filter(x => x.label.trim() || x.value.trim())) {
        const q = await api("/rest/v1/custom_registrations", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), tournament_id: selected.id, player_id: null, name: c.label, label: c.label, value: c.value, custom_data: c.value, is_public: true }) }, session.access_token);
        if (!q.ok) throw new Error(`CUSTOM SAVE FAILED: ${await q.text()}`);
      }

      // Rebuild this tournament's point ledger so points are never duplicated on repeated saves.
      const oldL = await api(`/rest/v1/point_ledger?tournament_id=eq.${enc(selected.id)}`, {}, session.access_token);
      if (oldL.ok) for (const x of await oldL.json()) if (x.id) {
        const d = await api(`/rest/v1/point_ledger?id=eq.${enc(String(x.id))}`, { method: "DELETE" }, session.access_token);
        if (!d.ok) throw new Error(`POINT LEDGER DELETE FAILED: ${await d.text()}`);
      }
      for (const x of results.filter(x => x.player_id)) {
        const points = x.rank === 1 ? 3 : x.rank === 2 ? 2 : 1;
        const q = await api("/rest/v1/point_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), tournament_id: selected.id, player_id: x.player_id, points, reason: `3ON3 ${x.rank === 1 ? "1ST" : x.rank === 2 ? "2ND" : "3RD"} PLACE` }) }, session.access_token);
        if (!q.ok) throw new Error(`POINT SAVE FAILED: ${await q.text()}`);
      }
      for (const team of teams.filter(x => x.members.some(Boolean))) {
        const points = team.rank === 1 ? 2 : 1;
        for (const pid of team.members.filter(Boolean)) {
          const q = await api("/rest/v1/point_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), tournament_id: selected.id, player_id: pid, points, reason: `TEAM BATTLE ${team.rank === 1 ? "1ST" : "2ND"} TEAM` }) }, session.access_token);
          if (!q.ok) throw new Error(`TEAM POINT SAVE FAILED: ${await q.text()}`);
        }
      }

      await loadAll();
      await openTournament(selected.id);
      setMessage("SAVED BOTH 3ON3 + TEAM BATTLE.");
    } catch (e) { setMessage(errText(e)); }
    finally { setSaving(false); }
  };

  const savePlayers = async () => {
    if (!session?.access_token) return;
    setSaving(true); setMessage("SAVING PLAYERS...");
    try {
      for (const p of players) {
        const existing = await api(`/rest/v1/players?id=eq.${enc(p.id)}`, {}, session.access_token);
        if (existing.ok) {
          const rows = await existing.json();
          const method = Array.isArray(rows) && rows.length ? "PATCH" : "POST";
          const path = method === "PATCH" ? `/rest/v1/players?id=eq.${enc(p.id)}` : "/rest/v1/players";
          const q = await api(path, { method, headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: p.id, name: p.name, nickname: p.nickname, is_active: true }) }, session.access_token);
          if (!q.ok) throw new Error(`PLAYER SAVE FAILED: ${await q.text()}`);
        }
      }
      await loadAll(); setMessage("PLAYERS SAVED.");
    } catch (e) { setMessage(errText(e)); }
    finally { setSaving(false); }
  };

  const sortedPlayers = useMemo(() => [...players].sort((a,b) => b.points - a.points || a.name.localeCompare(b.name)), [players]);

  if (authorized === false) return <main className="admin"><div className="gate"><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>{message || "ADMIN ACCESS REQUIRED."}</p><a href="/" className="back">BACK TO SITE ↗</a></div><style jsx global>{styles}</style></main>;
  if (authorized === null) return <main className="admin"><div className="gate"><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>CHECKING ACCESS...</p></div><style jsx global>{styles}</style></main>;

  return <main className="admin">
    <header className="adminHeader"><div><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>TOURNAMENT / PLAYER MANAGEMENT</p></div><a href="/" className="back">BACK TO SITE ↗</a></header>
    <nav className="tabs"><button className={tab === "tournaments" ? "active" : ""} onClick={() => setTab("tournaments")}>TOURNAMENTS</button><button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>PLAYERS / RANKING</button><button className="new" onClick={newTournament}>+ NEW TOURNAMENT</button></nav>

    {tab === "players" ? <section className="panel"><div className="panelHead"><div><p className="eyebrow">THE NUMBERS</p><h2>PLAYERS / RANKING</h2></div><button className="add primary" onClick={addPlayer}>+ ADD PLAYER</button></div>
      <div className="ranking"><div className="rankingHead"><span>RANK</span><span>PLAYER</span><span>POINTS</span></div>{sortedPlayers.map((p,i)=><div className="rankingRow" key={p.id}><b>{String(i+1).padStart(2,"0")}</b><div><input value={p.name} onChange={e => setPlayers(v => v.map(x => x.id === p.id ? {...x,name:e.target.value} : x))}/><input className="nick" placeholder="NICKNAME (OPTIONAL)" value={p.nickname} onChange={e => setPlayers(v => v.map(x => x.id === p.id ? {...x,nickname:e.target.value} : x))}/></div><strong>{p.points} PT</strong></div>)}</div>
      <div className="saveRow"><span>{message}</span><button className="save" onClick={savePlayers} disabled={saving}>{saving ? "SAVING..." : "SAVE PLAYERS"}</button></div>
    </section> : <div className="workspace">
      <aside className="list"><div className="listHead"><span>EVENTS</span><b>{tournaments.length}</b></div>{tournaments.map(t => <button key={t.id} className={`event ${t.id === selectedId ? "active" : ""}`} onClick={() => openTournament(t.id)}><small>{t.status}</small><strong>{t.name || "NO DATA"}</strong><span>{t.date || "NO DATE"} · {t.location || "NO LOCATION"}</span></button>)}</aside>
      <section className="editor">{!selected ? <div className="empty">SELECT A TOURNAMENT<br/>OR CREATE A NEW ONE</div> : <>
        <div className="editorHead"><div><p className="eyebrow">TOURNAMENT EDITOR</p><h2>{selected.name}</h2></div><span className="both">3ON3 + TEAM BATTLE</span></div>
        <div className="grid3"><Field label="TOURNAMENT NAME"><input value={selected.name} onChange={e => updateT("name",e.target.value)}/></Field><Field label="DATE"><input placeholder="2026.09.12" value={selected.date} onChange={e => updateT("date",e.target.value)}/></Field><Field label="LOCATION"><input value={selected.location} onChange={e => updateT("location",e.target.value)}/></Field></div>
        <div className="grid2"><Field label="PRIMARY DISPLAY FORMAT"><select value={selected.format} onChange={e => updateT("format",e.target.value)}><option value="3ON3">3ON3 / INDIVIDUAL</option><option value="TEAM">TEAM BATTLE</option></select></Field><Field label="STATUS"><select value={selected.status} onChange={e => updateT("status",e.target.value)}><option>ENTRY OPEN</option><option>UPCOMING</option><option>FINISHED</option></select></Field></div>

        <section className="block"><Title kicker="RESULT 01" title="3ON3 RESULTS" sub="INDIVIDUAL / 3 BEYS / 1ST 3PT · 2ND 2PT · 3RD 1PT"/>{[1,2,3].map(rank => { const r = results.find(x => x.rank === rank) ?? {id:uid(),rank:rank as 1|2|3,player_id:"",bey1:"",bey2:"",bey3:""}; return <div className="result" key={rank}><div className="place">{rank}<small>{rank===1?3:rank===2?2:1} PT</small></div><Field label="PLAYER"><select value={r.player_id} onChange={e => setResults(v => v.map(x => x.rank === rank ? {...x,player_id:e.target.value} : x))}><option value="">SELECT PLAYER</option>{players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}</select></Field>{([1,2,3] as const).map(n => <Field key={n} label={`BEY ${n}`}><input value={r[`bey${n}`]} onChange={e => setResults(v => v.map(x => x.rank === rank ? {...x,[`bey${n}`]:e.target.value} : x))}/></Field>)}</div>; })}</section>

        <section className="block"><Title kicker="RESULT 02" title="TEAM BATTLE" sub="1ST TEAM = 2PT EACH · 2ND TEAM = 1PT EACH · 3 MEMBERS PER TEAM"/>{[1,2].map(rank => { const team = teams.find(x => x.rank === rank) ?? {id:uid(),rank:rank as 1|2,name:`TEAM ${rank}`,members:["","",""]}; return <div className="team" key={rank}><div className="teamTop"><b>{rank===1?"1ST PLACE":"2ND PLACE"}</b><input value={team.name} onChange={e => setTeams(v => v.map(x => x.rank === rank ? {...x,name:e.target.value} : x))}/></div><div className="members">{[0,1,2].map(j => <select key={j} value={team.members[j] || ""} onChange={e => setTeams(v => v.map(x => x.rank === rank ? {...x,members:x.members.map((m,k)=>k===j?e.target.value:m)} : x))}><option value="">MEMBER {j+1}</option>{players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}</select>)}</div></div>; })}</section>

        <section className="block"><Title kicker="EXTRA DATA" title="CUSTOM" sub="OPTIONAL TOURNAMENT INFORMATION"/>{customs.map(c => <div className="custom" key={c.id}><input placeholder="LABEL" value={c.label} onChange={e => setCustoms(v => v.map(x => x.id === c.id ? {...x,label:e.target.value} : x))}/><input placeholder="VALUE" value={c.value} onChange={e => setCustoms(v => v.map(x => x.id === c.id ? {...x,value:e.target.value} : x))}/><button onClick={() => setCustoms(v => v.filter(x => x.id !== c.id))}>×</button></div>)}<button className="add" onClick={addCustom}>+ ADD CUSTOM FIELD</button></section>
        <div className="saveRow"><span>{loading ? "LOADING..." : message}</span><button className="save" onClick={saveTournament} disabled={saving}>{saving ? "SAVING..." : "SAVE TO DATABASE"}</button></div>
      </>}</section>
    </div>}
    <style jsx global>{styles}</style>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="field">{label}{children}</label>; }
function Title({kicker,title,sub}:{kicker:string;title:string;sub:string}) { return <div className="title"><p>{kicker}</p><h3>{title}</h3><span>{sub}</span></div>; }

const styles = `
*{box-sizing:border-box}html,body{margin:0;background:#08060d;color:#f4f1f8;font-family:Arial,Helvetica,sans-serif}button,input,select{font:inherit}.admin{min-height:100vh;padding:48px 5vw;background:radial-gradient(circle at 75% 0,rgba(111,55,190,.15),transparent 35%),#08060d}.adminHeader{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #292331;padding-bottom:28px}.adminHeader h1{font-size:72px;line-height:.9;margin:8px 0;letter-spacing:-4px}.adminHeader p:last-child{margin:0;color:#77717f;font-size:10px;letter-spacing:3px}.eyebrow{margin:0;color:#a99ab9;font-size:10px;letter-spacing:4px}.back{color:#fff;text-decoration:none;border:1px solid #40364d;padding:14px 18px;font-size:10px;letter-spacing:2px}.tabs{display:flex;gap:10px;margin:25px 0}.tabs button{border:1px solid #292331;background:#0d0a12;color:#8d8398;padding:13px 18px;font-size:10px;letter-spacing:2px;cursor:pointer}.tabs .active,.tabs .new{color:#fff;border-color:#9d6cff;background:#171020}.tabs .new{margin-left:auto}.workspace{display:grid;grid-template-columns:310px 1fr;gap:18px}.list,.editor,.panel{border:1px solid #292331;background:#0c0912}.list{padding:15px}.listHead{display:flex;justify-content:space-between;padding:10px 8px 15px;color:#77717f;font-size:10px;letter-spacing:3px}.listHead b{color:#9d6cff}.event{position:relative;width:100%;display:block;text-align:left;border:1px solid transparent;border-bottom-color:#292331;background:transparent;color:#fff;padding:18px 12px;cursor:pointer}.event.active{background:#171020;border-color:#9d6cff}.event small{display:block;color:#77717f;font-size:8px;letter-spacing:2px}.event strong{display:block;margin:8px 0;font-size:13px}.event span{display:block;color:#77717f;font-size:9px}.editor{padding:32px}.editorHead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #292331;padding-bottom:24px;margin-bottom:24px}.editorHead h2{font-size:34px;margin:8px 0 0;letter-spacing:-1px}.both{border:1px solid #9d6cff;color:#c9b6ff;padding:10px 12px;font-size:9px;letter-spacing:2px}.grid3,.grid2{display:grid;gap:12px}.grid3{grid-template-columns:2fr 1fr 1fr}.grid2{grid-template-columns:1fr 1fr}.field{display:block;color:#80758e;font-size:9px;letter-spacing:2px;margin-bottom:14px}.field input,.field select,.teamTop input,.members select,.custom input,.rankingRow input{display:block;width:100%;margin-top:7px;padding:12px;background:#08060d;border:1px solid #342b40;color:#fff;outline:0}.field input:focus,.field select:focus,.teamTop input:focus,.members select:focus,.custom input:focus,.rankingRow input:focus{border-color:#9d6cff}.block{border-top:1px solid #292331;margin-top:30px;padding-top:28px}.title p{margin:0;color:#9d6cff;font-size:9px;letter-spacing:3px}.title h3{margin:7px 0 5px;font-size:28px;letter-spacing:-1px}.title span{display:block;margin-bottom:18px;color:#665d70;font-size:9px;letter-spacing:2px}.result{display:grid;grid-template-columns:60px 1.3fr 1fr 1fr 1fr;gap:10px;border-bottom:1px solid #201b27;padding:14px 0;align-items:end}.place{font-size:28px;color:#9d6cff;padding-bottom:17px}.place small{display:block;font-size:8px;color:#77717f;margin-top:3px}.team{border:1px solid #292331;padding:16px;margin-bottom:12px}.teamTop{display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center}.teamTop b{color:#9d6cff;font-size:10px;letter-spacing:1px}.members{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.custom{display:grid;grid-template-columns:180px 1fr 40px;gap:10px;margin-bottom:10px}.custom button{border:1px solid #392f44;background:transparent;color:#aaa;height:42px;cursor:pointer}.add{border:1px dashed #493b55;background:transparent;color:#9d6cff;padding:12px 16px;cursor:pointer;font-size:9px;letter-spacing:2px}.primary{border:1px solid #9d6cff!important;background:#171020!important;color:#fff!important}.panel{padding:32px}.panelHead{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #292331;padding-bottom:24px;margin-bottom:22px}.panel h2{font-size:42px;margin:8px 0 0}.rankingHead,.rankingRow{display:grid;grid-template-columns:80px 1fr 140px;align-items:center}.rankingHead{padding:14px 0;color:#5e5966;font-size:9px;letter-spacing:2px;border-bottom:1px solid #292331}.rankingRow{min-height:82px;border-bottom:1px solid #292331}.rankingRow>b{color:#9d6cff;font-size:23px}.rankingRow strong{font-size:20px;color:#c29cff;text-align:right}.rankingRow .nick{margin-top:6px;color:#888}.saveRow{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:24px;color:#9d6cff;font-size:9px;letter-spacing:2px}.save{border:0;background:#f4f1f8;color:#08060d;padding:14px 22px;font-weight:700;font-size:10px;letter-spacing:2px;cursor:pointer}.save:disabled{opacity:.5}.empty,.gate{min-height:500px;display:grid;place-items:center;align-content:center;text-align:center;color:#77717f;letter-spacing:3px}.gate h1{margin:8px 0;font-size:65px}.gate p{font-size:10px}.gate .back{display:inline-block}@media(max-width:1000px){.workspace{grid-template-columns:1fr}.grid3,.grid2,.result,.members,.rankingHead,.rankingRow{grid-template-columns:1fr}.admin{padding:30px 16px}.adminHeader{display:block}.back{display:inline-block;margin-top:20px}.tabs{flex-wrap:wrap}.tabs .new{margin-left:0}.editor{padding:20px}.teamTop,.custom{grid-template-columns:1fr}.panelHead,.saveRow{display:block}.save{margin-top:15px}.rankingRow{padding:15px 0}.rankingRow strong{text-align:left}.both{margin-top:15px}}
`;
