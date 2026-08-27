"use client";

import { useEffect, useState } from "react";

type Tournament = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: "ENTRY OPEN" | "UPCOMING" | "FINISHED";
  format: "3ON3" | "TEAM";
};

type Player = {
  id: string;
  name: string;
  nickname?: string | null;
  points: number;
  wins: number;
  tournaments: number;
};

type Session = {
  access_token: string;
  user?: { id: string; email?: string };
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const FALLBACK_TOURNAMENTS: Tournament[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "MIDNIGHT BEY CLUB #01", date: "2026.09.12", location: "KANAGAWA", status: "ENTRY OPEN", format: "3ON3" },
  { id: "00000000-0000-4000-8000-000000000002", name: "MIDNIGHT BEY CLUB #02", date: "2026.10.10", location: "YOKOHAMA", status: "UPCOMING", format: "TEAM" },
  { id: "00000000-0000-4000-8000-000000000003", name: "MIDNIGHT BEY CLUB #00", date: "2026.08.09", location: "YAMATO", status: "FINISHED", format: "3ON3" },
];

function headers(token?: string) {
  const bearer = token || SUPABASE_ANON_KEY;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function api(path: string, init: RequestInit = {}, token?: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("SUPABASE ENVIRONMENT VARIABLES ARE MISSING.");
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { ...headers(token), ...(init.headers || {}) },
    cache: "no-store",
  });
}

function dateLabel(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.replaceAll("-", ".") : raw;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"tournaments" | "players">("tournaments");
  const [tournaments, setTournaments] = useState<Tournament[]>(FALLBACK_TOURNAMENTS);
  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState("LOADING...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("midnight_session");
      if (!raw) {
        setAuthorized(false);
        return;
      }
      const parsed = JSON.parse(raw) as Session;
      if (!parsed?.access_token || !parsed?.user?.id) {
        setAuthorized(false);
        return;
      }
      setSession(parsed);
    } catch {
      setAuthorized(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token || !session.user?.id) return;

    const load = async () => {
      try {
        const accountResponse = await api(
          `/rest/v1/accounts?select=is_admin,player_id,display_name&id=eq.${encodeURIComponent(session.user!.id)}&limit=1`,
          {},
          session.access_token
        );
        if (!accountResponse.ok) throw new Error(await accountResponse.text());
        const accounts = await accountResponse.json();
        if (!Array.isArray(accounts) || accounts[0]?.is_admin !== true) {
          setAuthorized(false);
          setMessage("ADMIN ACCESS REQUIRED.");
          return;
        }
        setAuthorized(true);

        const [tournamentResponse, playerResponse] = await Promise.all([
          api("/rest/v1/tournaments?select=*&order=tournament_date.asc", {}, session.access_token),
          api("/rest/v1/players?select=*&order=name.asc", {}, session.access_token),
        ]);

        if (tournamentResponse.ok) {
          const rows = await tournamentResponse.json();
          if (Array.isArray(rows) && rows.length) {
            setTournaments(rows.map((row: Record<string, unknown>) => ({
              id: String(row.id),
              name: String(row.name ?? ""),
              date: dateLabel(row.tournament_date ?? row.date),
              location: String(row.location ?? ""),
              status: String(row.status ?? "UPCOMING") as Tournament["status"],
              format: String(row.format ?? row.tournament_type ?? "3ON3").toUpperCase().includes("TEAM") ? "TEAM" : "3ON3",
            })));
          }
        }

        if (playerResponse.ok) {
          const rows = await playerResponse.json();
          if (Array.isArray(rows)) {
            setPlayers(rows.map((row: Record<string, unknown>) => ({
              id: String(row.id),
              name: String(row.name ?? "PLAYER"),
              nickname: row.nickname == null ? null : String(row.nickname),
              points: Number(row.points ?? 0),
              wins: Number(row.wins ?? 0),
              tournaments: Number(row.tournaments ?? 0),
            })));
          }
        }
        setMessage("");
      } catch (error) {
        setAuthorized(false);
        setMessage(error instanceof Error ? error.message : "ADMIN CHECK FAILED.");
      }
    };

    load();
  }, [session]);

  const updateTournament = (id: string, field: keyof Tournament, value: string) => {
    setTournaments((current) => current.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const updatePlayer = (id: string, field: keyof Player, value: string) => {
    setPlayers((current) => current.map((p) => p.id !== id ? p : {
      ...p,
      [field]: field === "name" || field === "nickname" ? value : Number(value),
    }));
  };

  const saveChanges = async () => {
    if (!session?.access_token || !authorized) return;
    setSaving(true);
    setMessage("SAVING...");

    try {
      for (const tournament of tournaments) {
        const response = await api(
          `/rest/v1/tournaments?id=eq.${encodeURIComponent(tournament.id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              name: tournament.name,
              tournament_date: tournament.date.replaceAll(".", "-"),
              location: tournament.location,
              status: tournament.status,
              format: tournament.format,
            }),
          },
          session.access_token
        );
        if (!response.ok) throw new Error(`TOURNAMENT SAVE FAILED: ${await response.text()}`);
      }

      for (const player of players) {
        const response = await api(
          `/rest/v1/players?id=eq.${encodeURIComponent(player.id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              name: player.name,
              nickname: player.nickname,
            }),
          },
          session.access_token
        );
        if (!response.ok) throw new Error(`PLAYER SAVE FAILED: ${await response.text()}`);
      }

      setMessage("SAVED.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SAVE FAILED.");
    } finally {
      setSaving(false);
    }
  };

  if (authorized === false) {
    return (
      <main className="admin">
        <div className="gate">
          <p className="eyebrow">MIDNIGHT BEY CLUB</p>
          <h1>ADMIN</h1>
          <p>ADMIN ACCESS REQUIRED.</p>
          <a href="/" className="back">BACK TO SITE ↗</a>
        </div>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  if (authorized === null) {
    return (
      <main className="admin">
        <div className="gate"><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>CHECKING ACCESS...</p></div>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  return (
    <main className="admin">
      <header className="adminHeader">
        <div>
          <div className="eyebrow">MIDNIGHT BEY CLUB</div>
          <h1>ADMIN</h1>
          <p>TOURNAMENT / PLAYER MANAGEMENT</p>
        </div>
        <a href="/" className="back">BACK TO SITE ↗</a>
      </header>

      <nav className="tabs">
        <button className={tab === "tournaments" ? "active" : ""} onClick={() => setTab("tournaments")}>TOURNAMENTS</button>
        <button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>RANKING</button>
      </nav>

      <section className="panel">
        {tab === "tournaments" && (
          <>
            <div className="sectionTitle"><span>NEXT BATTLES</span><h2>TOURNAMENTS</h2></div>
            <div className="cards">
              {tournaments.map((tournament) => (
                <article className="card" key={tournament.id}>
                  <label>TOURNAMENT NAME<input value={tournament.name} onChange={(e) => updateTournament(tournament.id, "name", e.target.value)} /></label>
                  <label>DATE<input value={tournament.date} onChange={(e) => updateTournament(tournament.id, "date", e.target.value)} /></label>
                  <label>LOCATION<input value={tournament.location} onChange={(e) => updateTournament(tournament.id, "location", e.target.value)} /></label>
                  <label>FORMAT<select value={tournament.format} onChange={(e) => updateTournament(tournament.id, "format", e.target.value)}><option value="3ON3">3ON3 / INDIVIDUAL</option><option value="TEAM">TEAM BATTLE</option></select></label>
                  <label>STATUS<select value={tournament.status} onChange={(e) => updateTournament(tournament.id, "status", e.target.value)}><option>ENTRY OPEN</option><option>UPCOMING</option><option>FINISHED</option></select></label>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "players" && (
          <>
            <div className="sectionTitle"><span>THE NUMBERS</span><h2>RANKING</h2></div>
            {players.length === 0 ? <div className="empty">NO PLAYERS</div> : (
              <div className="playerList">
                {players.map((player, index) => (
                  <div className="player" key={player.id}>
                    <div className="rank">{String(index + 1).padStart(2, "0")}</div>
                    <label>PLAYER<input value={player.name} onChange={(e) => updatePlayer(player.id, "name", e.target.value)} /></label>
                    <label>NICKNAME<input value={player.nickname ?? ""} onChange={(e) => updatePlayer(player.id, "nickname", e.target.value)} /></label>
                    <div className="stat"><span>PTS</span><strong>{player.points}</strong></div>
                    <div className="stat"><span>WINS</span><strong>{player.wins}</strong></div>
                    <div className="stat"><span>EVENTS</span><strong>{player.tournaments}</strong></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="saveArea">
          {message && <span className={message.includes("FAILED") || message.includes("ERROR") ? "saved error" : "saved"}>{message}</span>}
          <button className="save" onClick={saveChanges} disabled={saving}>{saving ? "SAVING..." : "SAVE CHANGES"}</button>
        </div>
      </section>

      <style jsx global>{styles}</style>
    </main>
  );
}

const styles = `
  * { box-sizing: border-box; }
  html { background: #08060d; }
  body { margin: 0; background: #08060d; color: #f4f1f8; font-family: Arial, Helvetica, sans-serif; }
  button, input, select { font: inherit; }
  .admin { min-height: 100vh; background: radial-gradient(circle at 75% 10%, rgba(111,55,190,.16), transparent 30%), #08060d; padding: 70px 7vw; }
  .adminHeader { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #292331; padding-bottom:35px; }
  .eyebrow, .sectionTitle span { font-size:11px; letter-spacing:4px; color:#a99ab9; }
  h1 { font-size:72px; margin:10px 0 5px; letter-spacing:-3px; }
  .adminHeader p { margin:0; color:#8d8398; letter-spacing:3px; font-size:11px; }
  .back { color:#f4f1f8; text-decoration:none; border:1px solid #40364d; padding:15px 20px; font-size:11px; letter-spacing:2px; }
  .tabs { display:flex; gap:10px; margin:35px 0; }
  .tabs button { background:transparent; color:#8d8398; border:1px solid #292331; padding:14px 22px; cursor:pointer; letter-spacing:2px; font-size:11px; }
  .tabs button.active { color:white; border-color:#9d6cff; background:#171020; }
  .panel { border:1px solid #292331; background:#0c0912; padding:40px; }
  .sectionTitle h2 { font-size:52px; margin:12px 0 35px; letter-spacing:-2px; }
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
  .card { border:1px solid #292331; padding:25px; background:#100c18; }
  label { display:block; color:#8d8398; font-size:10px; letter-spacing:2px; margin-bottom:18px; }
  input, select { display:block; width:100%; margin-top:8px; background:#08060d; border:1px solid #342b40; color:white; padding:13px; outline:none; }
  input:focus, select:focus { border-color:#9d6cff; }
  .playerList { border-top:1px solid #292331; }
  .player { display:grid; grid-template-columns:60px 2fr 2fr 80px 80px 80px; gap:16px; align-items:end; padding:22px 0; border-bottom:1px solid #292331; }
  .rank { font-size:24px; color:#9d6cff; padding-bottom:18px; }
  .stat { padding-bottom:14px; text-align:center; }
  .stat span { display:block; color:#5f576b; font-size:8px; letter-spacing:2px; }
  .stat strong { display:block; margin-top:6px; font-size:20px; }
  .saveArea { display:flex; justify-content:flex-end; align-items:center; gap:20px; margin-top:35px; }
  .saved { color:#9d6cff; font-size:11px; letter-spacing:2px; max-width:700px; word-break:break-word; }
  .saved.error { color:#ff6b81; }
  .save { border:0; background:#f4f1f8; color:#08060d; padding:16px 28px; font-weight:bold; letter-spacing:2px; cursor:pointer; white-space:nowrap; }
  .save:hover { background:#9d6cff; color:white; }
  .save:disabled { opacity:.5; cursor:not-allowed; }
  .empty, .gate { min-height:240px; display:grid; place-items:center; align-content:center; gap:18px; color:#77717f; letter-spacing:3px; text-align:center; }
  .gate h1 { margin:0; }
  .gate .back { margin-top:10px; }
  @media (max-width:900px) {
    .admin { padding:40px 20px; }
    .adminHeader { display:block; }
    .back { display:inline-block; margin-top:25px; }
    .panel { padding:20px; }
    .cards { grid-template-columns:1fr; }
    .player { grid-template-columns:1fr; }
    .stat { text-align:left; padding:8px 0; }
    h1 { font-size:52px; }
    .saveArea { display:block; }
    .saved { display:block; margin-bottom:15px; }
  }
`;
