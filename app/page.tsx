"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type TournamentStatus = "ENTRY OPEN" | "UPCOMING" | "FINISHED" | "NO DATA";
type TournamentFormat = "3ON3" | "TEAM" | "NO DATA";

type Tournament = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: TournamentStatus;
  format: TournamentFormat;
};

type Player = {
  id: string;
  name: string;
  nickname?: string | null;
  rank: number;
  points: number;
  wins: number;
  tournaments: number;
};

type ResultRow = Record<string, unknown>;

type Session = { access_token: string; user: { id: string }; login_id?: string; display_name?: string; player_id?: string | null; is_admin?: boolean };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const fallbackTournaments: Tournament[] = [
  {
    id: "fallback-1",
    name: "MIDNIGHT BEY CLUB #01",
    date: "2026.09.12",
    location: "KANAGAWA",
    status: "ENTRY OPEN",
    format: "3ON3",
  },
  {
    id: "fallback-2",
    name: "MIDNIGHT BEY CLUB #02",
    date: "2026.10.10",
    location: "YOKOHAMA",
    status: "UPCOMING",
    format: "3ON3",
  },
  {
    id: "fallback-3",
    name: "MIDNIGHT BEY CLUB #03",
    date: "",
    location: "",
    status: "UPCOMING",
    format: "NO DATA",
  },
];

const emptyPlayers: Player[] = [];

function apiHeaders(accessToken?: string) {
  const token = accessToken || SUPABASE_ANON_KEY;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function supabaseFetch(
  path: string,
  init: RequestInit = {},
  accessToken?: string
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }

  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...apiHeaders(accessToken),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

function displayDate(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replaceAll("-", ".");
  return raw;
}

function valueFrom(row: ResultRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return undefined;
}

function numberFrom(row: ResultRow, keys: string[]) {
  const value = valueFrom(row, keys);
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function stringFrom(row: ResultRow, keys: string[]) {
  const value = valueFrom(row, keys);
  return value === undefined ? undefined : String(value);
}

function getResultRank(row: ResultRow) {
  return numberFrom(row, [
    "rank",
    "place",
    "placement",
    "position",
    "standing",
    "result_rank",
  ]);
}

function getResultPlayerId(row: ResultRow) {
  return stringFrom(row, ["player_id", "playerId"]);
}

function getResultTeamId(row: ResultRow) {
  return stringFrom(row, ["team_id", "teamId"]);
}

function getResultName(row: ResultRow, players: Player[]) {
  const direct = stringFrom(row, [
    "player_name",
    "nickname",
    "name",
    "display_name",
  ]);
  if (direct) return direct;

  const id = getResultPlayerId(row);
  if (id) {
    const player = players.find((p) => p.id === id);
    if (player) return player.nickname || player.name;
  }

  return "PLAYER";
}

function getCustomData(row: ResultRow) {
  const value = valueFrom(row, [
    "custom",
    "custom_data",
    "customization",
    "combo",
    "deck",
    "registration_data",
    "beyblade",
  ]);

  if (value === undefined) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function renderData(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value !== "object") {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <div className="data-list">
        {value.map((item, index) => (
          <div className="data-line" key={index}>
            {renderData(item)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="data-list">
      {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
        <div className="data-line" key={key}>
          <span className="data-key">{key.replaceAll("_", " ")}</span>
          <span className="data-value">{renderData(item)}</span>
        </div>
      ))}
    </div>
  );
}

function getTournamentFormat(row: ResultRow): TournamentFormat {
  const raw = String(
    row.format ?? row.tournament_format ?? row.type ?? row.tournament_type ?? row.event_type ?? ""
  ).toUpperCase();
  if (raw.includes("TEAM")) return "TEAM";
  if (raw.includes("3ON3") || raw.includes("3 ON 3") || raw.includes("THREE")) return "3ON3";
  const name = String(row.name ?? "").toUpperCase();
  if (name.includes("3ON3") || name.includes("3 ON 3")) return "3ON3";
  return "3ON3";
}

function getThreeBeys(row: ResultRow): unknown[] {
  const direct = [
    ["bey1", "bey_1", "custom1", "custom_1", "blade1", "combo1"],
    ["bey2", "bey_2", "custom2", "custom_2", "blade2", "combo2"],
    ["bey3", "bey_3", "custom3", "custom_3", "blade3", "combo3"],
  ].map((keys) => valueFrom(row, keys));
  if (direct.some((v) => v !== undefined)) return direct;

  const packed = valueFrom(row, ["custom", "custom_data", "customization", "combo", "deck", "registration_data", "beyblade"]);
  if (Array.isArray(packed)) return packed.slice(0, 3);
  if (packed && typeof packed === "object") {
    const obj = packed as Record<string, unknown>;
    const values = [
      obj.bey1 ?? obj.bey_1 ?? obj.custom1 ?? obj.custom_1,
      obj.bey2 ?? obj.bey_2 ?? obj.custom2 ?? obj.custom_2,
      obj.bey3 ?? obj.bey_3 ?? obj.custom3 ?? obj.custom_3,
    ];
    if (values.some((v) => v !== undefined)) return values;
  }
  return [];
}

function customRowsForPlayer(rows: ResultRow[], playerId?: string) {
  if (!playerId) return [];
  return rows.filter((row) => String(row.player_id ?? row.playerId ?? "") === playerId);
}

function mergePlayers(
  rankingRows: ResultRow[],
  playerRows: ResultRow[]
): Player[] {
  const source = rankingRows.length ? rankingRows : playerRows;

  return source
    .map((row, index) => {
      const points =
        numberFrom(row, ["total_points", "points", "point"]) ?? 0;
      const wins =
        numberFrom(row, ["wins", "win_count", "victories"]) ?? 0;
      const tournaments =
        numberFrom(row, [
          "tournaments",
          "tournament_count",
          "events",
          "event_count",
        ]) ?? 0;

      return {
        id: String(row.id ?? row.player_id ?? index),
        name: String(row.name ?? row.display_name ?? "PLAYER"),
        nickname:
          row.nickname === undefined || row.nickname === null
            ? null
            : String(row.nickname),
        rank: numberFrom(row, ["rank", "ranking", "position"]) ?? index + 1,
        points,
        wins,
        tournaments,
      };
    })
    .sort((a, b) => b.points - a.points)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tournaments, setTournaments] =
    useState<Tournament[]>(fallbackTournaments);
  const [players, setPlayers] = useState<Player[]>(emptyPlayers);

  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [customRows, setCustomRows] = useState<ResultRow[]>([]);
  const [teamRows, setTeamRows] = useState<ResultRow[]>([]);
  const [teamMemberRows, setTeamMemberRows] = useState<ResultRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "signup">("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [accountIsAdmin, setAccountIsAdmin] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  const [rankingLoading, setRankingLoading] = useState(true);

  // Derived tournament-detail data used by the modal.
  // Keep this here so TypeScript can resolve the names used by the JSX.
  const resultRowsSorted = useMemo(
    () => [...resultRows].sort((a, b) => (getResultRank(a) ?? 999) - (getResultRank(b) ?? 999)),
    [resultRows]
  );

  const customByPlayer = useMemo(() => {
    const map = new Map<string, ResultRow>();
    for (const row of customRows) {
      const playerId = String(row.player_id ?? row.playerId ?? "");
      if (playerId && !map.has(playerId)) map.set(playerId, row);
    }
    return map;
  }, [customRows]);

  const rpc = async (name: string, body: Record<string, unknown>) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store"
    });
    const text = await response.text(); let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error(data?.message || data?.error || text || "REQUEST FAILED.");
    return data;
  };

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("midnight_session") : null;
    if (!saved) return;
    try { const current = JSON.parse(saved) as Session; if (!current?.access_token || !current?.user?.id) throw new Error(); setSession(current); setDisplayName(current.display_name || ""); setLoginId(current.login_id || ""); setSelectedPlayerId(current.player_id || ""); setAccountIsAdmin(current.is_admin === true); } catch { window.localStorage.removeItem("midnight_session"); }
  }, []);

  const loadAccountProfile = async (accessToken: string) => {
    try { const data = await rpc("get_account_session", { p_access_token: accessToken }); if (!data) return; setAccountIsAdmin(data.is_admin === true); setDisplayName(String(data.display_name || "")); setSelectedPlayerId(data.player_id ? String(data.player_id) : ""); } catch {}
  };

  useEffect(() => { if (session?.access_token) loadAccountProfile(session.access_token); }, [session]);

  useEffect(() => {
    const loadData = async () => {
      setRankingLoading(true);

      try {
        const tournamentResponse = await supabaseFetch(
          "/rest/v1/tournaments?select=*&order=tournament_date.asc"
        );

        if (tournamentResponse.ok) {
          const rows = await tournamentResponse.json();
          if (Array.isArray(rows) && rows.length) {
            setTournaments(
              rows.map((row: ResultRow) => ({
                id: String(row.id),
                name: String(row.name ?? `MIDNIGHT BEY CLUB #${row.id}`),
                date: displayDate(row.tournament_date ?? row.date),
                location: String(row.location ?? ""),
                status: String(row.status ?? "UPCOMING") as TournamentStatus,
                format: getTournamentFormat(row),
              }))
            );
          }
        }

        const [rankingResponse, totalResponse, playerResponse] =
          await Promise.all([
            supabaseFetch(
              "/rest/v1/player_rankings?select=*&order=points.desc"
            ),
            supabaseFetch(
              "/rest/v1/player_total_points?select=*"
            ),
            supabaseFetch(
              "/rest/v1/players?select=*&order=name.asc"
            ),
          ]);

        const rankingRows = rankingResponse.ok
          ? await rankingResponse.json()
          : [];
        const totalRows = totalResponse.ok ? await totalResponse.json() : [];
        const playerRows = playerResponse.ok
          ? await playerResponse.json()
          : [];

        const merged = mergePlayers(
          Array.isArray(rankingRows) ? rankingRows : [],
          Array.isArray(totalRows) && totalRows.length
            ? totalRows
            : Array.isArray(playerRows)
              ? playerRows
              : []
        );

        if (merged.length) {
          setPlayers(merged);
        } else {
          setPlayers([]);
        }
      } catch (error) {
        console.error("Failed to load MIDNIGHT BEY CLUB data:", error);
      } finally {
        setRankingLoading(false);
      }
    };

    loadData();
  }, []);

  const openTournament = async (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setResultRows([]);
    setCustomRows([]);
    setTeamRows([]);
    setTeamMemberRows([]);

    if (!tournament.id || tournament.id.startsWith("nodata-") || tournament.format === "NO DATA") return;

    setDetailLoading(true);

    try {
      const [resultsResponse, customResponse, teamsResponse] =
        await Promise.all([
          supabaseFetch(
            `/rest/v1/tournament_results?select=*&tournament_id=eq.${encodeURIComponent(
              tournament.id
            )}`
          ),
          supabaseFetch(
            `/rest/v1/custom_registrations?select=*`
          ),
          supabaseFetch(
            `/rest/v1/teams?select=*&tournament_id=eq.${encodeURIComponent(
              tournament.id
            )}`
          ),
        ]);

      const results = resultsResponse.ok ? await resultsResponse.json() : [];
      const customs = customResponse.ok ? await customResponse.json() : [];
      const teams = teamsResponse.ok ? await teamsResponse.json() : [];

      setResultRows(Array.isArray(results) ? results : []);
      setCustomRows(Array.isArray(customs) ? customs : []);
      setTeamRows(Array.isArray(teams) ? teams : []);

      if (Array.isArray(teams) && teams.length) {
        const ids = teams
          .map((team: ResultRow) => team.id)
          .filter(Boolean)
          .map((id) => encodeURIComponent(String(id)));

        if (ids.length) {
          const membersResponse = await supabaseFetch(
            `/rest/v1/team_members?select=*&team_id=in.(${ids.join(",")})`
          );
          if (membersResponse.ok) {
            const members = await membersResponse.json();
            setTeamMemberRows(Array.isArray(members) ? members : []);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load tournament details:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeTournament = () => {
    setSelectedTournament(null);
    setResultRows([]);
    setCustomRows([]);
    setTeamRows([]);
    setTeamMemberRows([]);
  };

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const tournamentCards = useMemo(() => {
    // Only real tournament records with a name are shown as tournaments.
    // Empty/placeholder DB rows are treated as NO DATA instead of exposing UUIDs.
    const actual = [...tournaments]
      .filter((t) => t.name && t.name.trim() && t.name !== "NO DATA")
      .sort((a, b) => {
        const da = a.date || "9999.99.99";
        const db = b.date || "9999.99.99";
        return da.localeCompare(db);
      });

    const cards: Tournament[] = actual.map((t) => ({ ...t }));

    while (cards.length < 3) {
      cards.push({
        id: `nodata-${cards.length + 1}`,
        name: "NO DATA",
        date: "",
        location: "",
        status: "NO DATA",
        format: "NO DATA",
      });
    }

    return cards;
  }, [tournaments]);

  const historyCount = tournaments.filter(
    (t) => t.status === "FINISHED"
  ).length;

  const signUp = async () => {
    const id = loginId.trim(), name = displayName.trim();
    if (!id || !name || !password) { setAccountMessage("ID, DISPLAY NAME AND PASSWORD ARE REQUIRED."); return; }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(id)) { setAccountMessage("ID MUST BE 3-32 CHARACTERS."); return; }
    if (password.length < 6) { setAccountMessage("PASSWORD MUST BE AT LEAST 6 CHARACTERS."); return; }
    setAccountLoading(true); setAccountMessage("");
    try {
      const data = await rpc("register_account", { p_login_id:id, p_password:password, p_display_name:name });
      const next: Session = { access_token:String(data.access_token), user:{id:String(data.user_id)}, login_id:String(data.login_id||id), display_name:String(data.display_name||name), player_id:data.player_id?String(data.player_id):null, is_admin:data.is_admin===true };
      localStorage.setItem("midnight_session", JSON.stringify(next)); setSession(next); setAccountIsAdmin(next.is_admin===true); setSelectedPlayerId(next.player_id||"");
      setAccountMessage("ACCOUNT CREATED.");
    } catch(e) { setAccountMessage(e instanceof Error ? e.message : "SIGN UP FAILED."); } finally { setAccountLoading(false); }
  };

  const login = async () => {
    const id=loginId.trim(); if(!id||!password){setAccountMessage("ID AND PASSWORD ARE REQUIRED.");return;}
    setAccountLoading(true); setAccountMessage("");
    try {
      const data=await rpc("login_account",{p_login_id:id,p_password:password});
      const next: Session={access_token:String(data.access_token),user:{id:String(data.user_id)},login_id:String(data.login_id||id),display_name:String(data.display_name||""),player_id:data.player_id?String(data.player_id):null,is_admin:data.is_admin===true};
      localStorage.setItem("midnight_session",JSON.stringify(next)); setSession(next); setDisplayName(next.display_name||""); setAccountIsAdmin(next.is_admin===true); setSelectedPlayerId(next.player_id||""); setAccountMessage("LOGGED IN.");
    } catch(e){setAccountMessage(e instanceof Error?e.message:"LOGIN FAILED.");} finally{setAccountLoading(false);}
  };

  const linkPlayer = async () => {
    if(!session?.access_token||!selectedPlayerId){setAccountMessage("SELECT YOUR PLAYER.");return;}
    setAccountLoading(true); setAccountMessage("");
    try { await rpc("link_player_account",{p_access_token:session.access_token,p_player_id:selectedPlayerId}); const next={...session,player_id:selectedPlayerId}; localStorage.setItem("midnight_session",JSON.stringify(next)); setSession(next); setAccountMessage("PLAYER LINKED."); } catch(e){setAccountMessage(e instanceof Error?e.message:"PLAYER LINK FAILED.");} finally{setAccountLoading(false);}
  };

  const logout = () => { localStorage.removeItem("midnight_session"); setSession(null); setAccountIsAdmin(false); setSelectedPlayerId(""); setLoginId(""); setPassword(""); setAccountMessage("LOGGED OUT."); };

  const openAdmin = async () => { if(!session?.access_token){setAccountMessage("LOGIN REQUIRED.");return;} if(!accountIsAdmin){setAccountMessage("ADMIN ACCESS REQUIRED.");return;} window.location.href="/admin"; };

  return (
    <main className="site">
      <header className="header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => scrollTo("home")}
            aria-label="MIDNIGHT BEY CLUB"
          >
            <img
              src="/image0.png"
              alt="MIDNIGHT BEY CLUB"
              className="brand-logo"
            />
          </button>

          <nav className={`nav ${menuOpen ? "nav-open" : ""}`}>
            <button onClick={() => scrollTo("tournaments")}>
              TOURNAMENTS
            </button>
            <button onClick={() => scrollTo("ranking")}>RANKING</button>
            <button onClick={() => scrollTo("history")}>HISTORY</button>
            <button onClick={() => scrollTo("about")}>ABOUT</button>
          </nav>

          <div className="header-actions">
            <button
              className="account-button"
              onClick={() => {
                setAccountOpen(true);
                setAccountMessage("");
              }}
            >
              {session ? "ACCOUNT" : "LOGIN"}
            </button>

            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <section id="home" className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <p className="eyebrow">MIDNIGHT BEY CLUB / OFFICIAL WEB</p>

          <img
            src="/image0.png"
            alt="MIDNIGHT BEY CLUB"
            className="hero-logo"
          />

          <h1>
            NO SLEEP.
            <br />
            KEEP SPIN.
          </h1>

          <p className="hero-copy">
            BEYBLADE X COMMUNITY
            <br />
            TOURNAMENT / RANKING / ARCHIVE
          </p>

          <button
            className="primary-button"
            onClick={() => scrollTo("tournaments")}
          >
            VIEW TOURNAMENTS
            <span>↗</span>
          </button>
        </div>

        <div className="hero-bottom">
          <span>KANAGAWA / JAPAN</span>
          <span>EST. 2026</span>
        </div>
      </section>

      <section id="tournaments" className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">NEXT BATTLES</p>
            <h2>TOURNAMENTS</h2>
          </div>
          <span className="section-number">01</span>
        </div>

        <div className="tournament-grid">
          {tournamentCards.map((tournament, index) => {
            const noData = tournament.name === "NO DATA";

            return (
              <button
                className={`tournament-card ${noData ? "no-data-card" : ""}`}
                key={tournament.id}
                onClick={() => openTournament(tournament)}
                type="button"
                aria-label={
                  noData
                    ? `Tournament ${index + 1}, no data`
                    : tournament.name
                }
              >
                <div className="card-top">
                  <span
                    className={`status ${
                      tournament.status === "ENTRY OPEN" ? "open" : ""
                    }`}
                  >
                    {noData ? "NO DATA" : tournament.status}
                  </span>
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                </div>

                <div className="card-main">
                  {tournament.date ? (
                    <p className="date">{tournament.date}</p>
                  ) : (
                    <p className="date">&nbsp;</p>
                  )}

                  <h3>{tournament.name}</h3>

                  <p className="location">
                    {tournament.location || "ARCHIVE SLOT"}
                  </p>
                  {!noData && (
                    <p className="format-label">3ON3 + TEAM</p>
                  )}
                </div>

                <div className="card-arrow">
                  {noData ? "+" : "↗"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section id="ranking" className="section ranking-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE NUMBERS</p>
            <h2>RANKING</h2>
          </div>
          <span className="section-number">02</span>
        </div>

        {rankingLoading ? (
          <div className="empty-state">LOADING...</div>
        ) : players.length === 0 ? (
          <div className="empty-state">
            <strong>NO DATA</strong>
            <span>PLAYER RANKING WILL APPEAR HERE.</span>
          </div>
        ) : (
          <>
            <div className="ranking-table">
              <div className="ranking-head">
                <span>RANK</span>
                <span>PLAYER</span>
                <span>WINS</span>
                <span>EVENTS</span>
                <span>PTS</span>
              </div>

              {players.map((player) => (
                <div className="ranking-row" key={player.id}>
                  <span className="rank">
                    {String(player.rank).padStart(2, "0")}
                  </span>
                  <span className="player-name">
                    {player.nickname || player.name}
                  </span>
                  <span>{player.wins}</span>
                  <span>{player.tournaments}</span>
                  <strong>{player.points}</strong>
                </div>
              ))}
            </div>

            <div className="ranking-note">
              <span>CUMULATIVE POINTS</span>
              <span>1ST 3PT / 2ND 2PT / 3RD 1PT</span>
            </div>
          </>
        )}
      </section>

      <section id="history" className="section history-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE ARCHIVE</p>
            <h2>
              SPIN AFTER
              <br />
              <span>SPIN.</span>
            </h2>
          </div>
          <span className="section-number">03</span>
        </div>

        <div className="history-content">
          <div className="history-big">
            <span>2026</span>
            <strong>08</strong>
          </div>

          <div className="history-text">
            <p>
              MIDNIGHT BEY CLUB is a Beyblade X community built around
              competition, records and the people who keep the stadium
              spinning.
            </p>
            <p>
              Every tournament becomes part of the archive. Every battle
              leaves a record.
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="about-section">
        <div className="about-inner">
          <p className="eyebrow">MIDNIGHT BEY CLUB</p>

          <img
            src="/image0.png"
            alt="MIDNIGHT BEY CLUB"
            className="about-logo"
          />

          <h2>
            NO SLEEP.
            <br />
            KEEP SPIN.
          </h2>

          <p className="about-copy">
            MIDNIGHT BEY CLUB
            <br />
            BEYBLADE X COMMUNITY
            <br />
            KANAGAWA / JAPAN
          </p>

          <div className="about-line" />

          <div className="footer-meta">
            <span>© 2026 MIDNIGHT BEY CLUB</span>
            <span>ALL BATTLES MATTER.</span>
          </div>
        </div>
      </section>

      {selectedTournament && (
        <div
          className="modal-backdrop"
          onClick={closeTournament}
          role="presentation"
        >
          <div
            className="detail-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selectedTournament.name}
          >
            <button
              className="close-button"
              onClick={closeTournament}
              type="button"
            >
              ×
            </button>

            <div className="modal-kicker">
              TOURNAMENT / 3ON3 + TEAM
            </div>

            <h2>{selectedTournament.name}</h2>

            {selectedTournament.name === "NO DATA" ? (
              <div className="modal-empty">
                <strong>NO DATA</strong>
                <span>
                  THIS TOURNAMENT SLOT IS READY FOR A FUTURE EVENT.
                </span>
              </div>
            ) : detailLoading ? (
              <div className="modal-empty">
                <strong>LOADING...</strong>
              </div>
            ) : (
              <>
                <div className="modal-meta">
                  <span>{selectedTournament.date || "DATE TBA"}</span>
                  <span>
                    {selectedTournament.location || "LOCATION TBA"}
                  </span>
                  <span>{selectedTournament.status}</span>
                </div>

                <div className="detail-block">
                  <div className="detail-title">RESULTS</div>

                  {resultRowsSorted.length === 0 ? (
                    <div className="detail-no-data">NO DATA</div>
                  ) : (
                    <div className="results-list">
                      {resultRowsSorted.map((row, index) => {
                        const rank = getResultRank(row) ?? index + 1;
                        const playerId = getResultPlayerId(row);
                        const customRow = playerId
                          ? customByPlayer.get(playerId)
                          : undefined;
                        const custom =
                          getCustomData(row) ??
                          (customRow ? getCustomData(customRow) : null);
                        const threeBeys =
                          getThreeBeys(row).length
                            ? getThreeBeys(row)
                            : customRow
                              ? getThreeBeys(customRow)
                              : [];

                        return (
                          <div className="result-card" key={String(row.id ?? index)}>
                            <div className="result-rank">
                              {String(rank).padStart(2, "0")}
                            </div>

                            <div className="result-info">
                              <strong>
                                {getResultName(row, players)}
                              </strong>

                              {getResultTeamId(row) && (
                                <span>
                                  TEAM / {getResultTeamId(row)}
                                </span>
                              )}

                              {threeBeys.length > 0 ? (
                                <div className="custom-box">
                                  <div className="custom-label">3 BEYS</div>
                                  <div className="three-bey-grid">
                                    {threeBeys.map((bey, beyIndex) => (
                                      <div className="three-bey-card" key={beyIndex}>
                                        <span>BEY {beyIndex + 1}</span>
                                        {renderData(
                                          typeof bey === "string"
                                            ? (() => { try { return JSON.parse(bey); } catch { return bey; } })()
                                            : bey
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : custom ? (
                                <div className="custom-box">
                                  <div className="custom-label">CUSTOM</div>
                                  {renderData(custom)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {teamRows.length > 0 && (
                  <div className="detail-block">
                    <div className="detail-title">TEAM RESULTS</div>
                    <div className="team-list">
                      {teamRows.map((team, index) => {
                        const teamId = String(team.id ?? "");
                        const members = teamMemberRows.filter(
                          (member) =>
                            String(
                              member.team_id ?? member.teamId ?? ""
                            ) === teamId
                        );

                        return (
                          <div className="team-card" key={teamId || index}>
                            <strong>
                              {String(
                                team.name ??
                                  team.team_name ??
                                  `TEAM ${index + 1}`
                              )}
                            </strong>

                            {members.length > 0 && (
                              <div className="team-members">
                                {members.map((member, memberIndex) => {
                                  const playerId = String(
                                    member.player_id ??
                                      member.playerId ??
                                      ""
                                  );
                                  const player = players.find(
                                    (p) => p.id === playerId
                                  );

                                  return (
                                    <span
                                      key={`${teamId}-${memberIndex}`}
                                    >
                                      {player?.nickname ||
                                        player?.name ||
                                        playerId ||
                                        "PLAYER"}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {resultRowsSorted.length === 0 &&
                  customRows.length > 0 && (
                    <div className="detail-block">
                      <div className="detail-title">CUSTOM</div>
                      <div className="custom-list">
                        {customRows.map((row, index) => (
                          <div className="custom-registration" key={String(row.id ?? index)}>
                            {renderData(
                              getCustomData(row) ?? row
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {accountOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setAccountOpen(false)}
          role="presentation"
        >
          <div
            className="account-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Account"
          >
            <button
              className="close-button"
              onClick={() => setAccountOpen(false)}
              type="button"
            >
              ×
            </button>

            <div className="modal-kicker">MEMBER ACCOUNT</div>

            {session ? (
              <>
                <h2>ACCOUNT</h2>
                <p className="account-email">
                  ID / {loginId || "SIGNED IN"}
                  {accountIsAdmin ? " / ADMIN" : ""}
                </p>

                <div className="account-block">
                  <label htmlFor="player-link">PLAYER</label>
                  <select
                    id="player-link"
                    value={selectedPlayerId}
                    onChange={(event) =>
                      setSelectedPlayerId(event.target.value)
                    }
                  >
                    <option value="">SELECT PLAYER</option>
                    {players.map((player) => (
                      <option value={player.id} key={player.id}>
                        {player.nickname || player.name}
                      </option>
                    ))}
                  </select>

                  <button
                    className="primary-button full"
                    onClick={linkPlayer}
                    type="button"
                    disabled={accountLoading || players.length === 0}
                  >
                    LINK PLAYER
                  </button>
                </div>

                <button
                  className="primary-button full"
                  onClick={openAdmin}
                  type="button"
                >
                  ADMIN
                </button>

                <button
                  className="secondary-button"
                  onClick={logout}
                  type="button"
                >
                  LOG OUT
                </button>
              </>
            ) : (
              <>
                <h2>{accountMode === "login" ? "LOGIN" : "JOIN"}</h2>

                {accountMode === "signup" && (
                  <div className="account-field">
                    <label htmlFor="display-name">DISPLAY NAME</label>
                    <input
                      id="display-name"
                      value={displayName}
                      onChange={(event) =>
                        setDisplayName(event.target.value)
                      }
                      placeholder="YOUR NAME"
                    />
                  </div>
                )}

                <div className="account-field">
                  <label htmlFor="login-id">ID</label>
                  <input
                    id="login-id"
                    type="text"
                    value={loginId}
                    onChange={(event) =>
                      setLoginId(event.target.value.replace(/\s/g, ""))
                    }
                    placeholder="YOUR ID"
                    autoComplete="username"
                    maxLength={32}
                  />
                </div>

                <div className="account-field">
                  <label htmlFor="password">PASSWORD</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="PASSWORD"
                  />
                </div>

                <button
                  className="primary-button full"
                  onClick={accountMode === "login" ? login : signUp}
                  type="button"
                  disabled={accountLoading}
                >
                  {accountLoading
                    ? "PLEASE WAIT..."
                    : accountMode === "login"
                      ? "LOGIN"
                      : "CREATE ACCOUNT"}
                </button>

                <button
                  className="text-button"
                  onClick={() => {
                    setAccountMode(
                      accountMode === "login" ? "signup" : "login"
                    );
                    setAccountMessage("");
                  }}
                  type="button"
                >
                  {accountMode === "login"
                    ? "CREATE A NEW ACCOUNT"
                    : "BACK TO LOGIN"}
                </button>
              </>
            )}

            {accountMessage && (
              <p className="account-message">{accountMessage}</p>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #050507;
          color: #f4f1f8;
          font-family: Arial, Helvetica, sans-serif;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .site {
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 75% 15%,
              rgba(91, 45, 170, 0.18),
              transparent 28%
            ),
            #050507;
        }

        .header {
          position: fixed;
          z-index: 100;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(5, 5, 7, 0.78);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-inner {
          max-width: 1400px;
          height: 78px;
          margin: 0 auto;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .brand-logo {
          width: 130px;
          height: 52px;
          object-fit: contain;
          object-position: center;
          filter: brightness(1.1);
        }

        .nav {
          display: flex;
          gap: 32px;
          align-items: center;
        }

        .nav button,
        .account-button {
          border: 0;
          background: transparent;
          color: #aaa6b2;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          transition: 0.25s;
        }

        .nav button:hover,
        .account-button:hover {
          color: white;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .account-button {
          padding: 9px 0;
          color: #c29cff;
        }

        .menu-button {
          display: none;
          width: 40px;
          height: 40px;
          padding: 8px;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .menu-button span {
          display: block;
          height: 2px;
          margin: 6px 0;
          background: white;
        }

        .hero {
          min-height: 100vh;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 130px 24px 70px;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .hero-glow {
          position: absolute;
          width: 650px;
          height: 650px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(99, 45, 190, 0.22),
            transparent 68%
          );
          filter: blur(20px);
        }

        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 850px;
        }

        .eyebrow {
          margin: 0 0 20px;
          color: #8f899b;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3em;
        }

        .hero-logo {
          width: min(500px, 82vw);
          max-height: 220px;
          object-fit: contain;
          margin: 0 auto 26px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(48px, 9vw, 108px);
          line-height: 0.88;
          letter-spacing: -0.055em;
          font-weight: 900;
        }

        .hero-copy {
          margin: 30px 0;
          color: #8f899b;
          font-size: 10px;
          line-height: 1.9;
          letter-spacing: 0.28em;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 16px 22px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.05);
          color: white;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          transition: 0.25s;
        }

        .primary-button:hover {
          background: white;
          color: black;
        }

        .primary-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .primary-button span {
          font-size: 18px;
        }

        .primary-button.full {
          width: 100%;
        }

        .secondary-button {
          width: 100%;
          padding: 14px 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: transparent;
          color: #aaa6b2;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
        }

        .secondary-button:hover {
          color: white;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #9c68ed;
          cursor: pointer;
          font-size: 9px;
          letter-spacing: 0.16em;
          font-weight: 700;
          padding: 10px 0;
        }

        .hero-bottom {
          position: absolute;
          left: 32px;
          right: 32px;
          bottom: 28px;
          display: flex;
          justify-content: space-between;
          color: #5e5966;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
        }

        .section {
          max-width: 1400px;
          margin: 0 auto;
          padding: 130px 32px;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 55px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: clamp(48px, 7vw, 90px);
          line-height: 0.9;
          letter-spacing: -0.055em;
        }

        .section-number {
          color: #5e5966;
          font-size: 12px;
          letter-spacing: 0.2em;
        }

        .tournament-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .tournament-card {
          position: relative;
          min-height: 330px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            linear-gradient(
              145deg,
              rgba(101, 49, 180, 0.14),
              rgba(255, 255, 255, 0.025)
            );
          color: inherit;
          cursor: pointer;
          transition: 0.3s;
        }

        .tournament-card:hover {
          transform: translateY(-5px);
          border-color: rgba(145, 93, 230, 0.5);
        }

        .no-data-card {
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.025),
              rgba(255, 255, 255, 0.01)
            );
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          color: #66616d;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .status {
          color: #77717f;
        }

        .status.open {
          color: #b68aff;
        }

        .date {
          margin: 0 0 15px;
          color: #8c8793;
          font-size: 12px;
          letter-spacing: 0.15em;
        }

        .card-main h3 {
          margin: 0;
          max-width: 280px;
          font-size: 28px;
          line-height: 1;
          letter-spacing: -0.035em;
        }

        .location {
          margin: 18px 0 0;
          color: #77717f;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
        }

        .card-arrow {
          position: absolute;
          right: 22px;
          bottom: 18px;
          color: #80798a;
          font-size: 22px;
        }

        .format-label {
          margin: 8px 0 0;
          color: #9c68ed;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.2em;
        }

        .three-bey-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .three-bey-card {
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
        }

        .three-bey-card > span {
          display: block;
          margin-bottom: 8px;
          color: #9c68ed;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .ranking-section {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ranking-table {
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .ranking-head,
        .ranking-row {
          display: grid;
          grid-template-columns: 100px 1fr 120px 120px 100px;
          align-items: center;
        }

        .ranking-head {
          min-height: 48px;
          color: #5e5966;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ranking-row {
          min-height: 82px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          transition: 0.2s;
        }

        .ranking-row:hover {
          background: rgba(116, 64, 201, 0.08);
        }

        .rank {
          color: #77717f;
          font-size: 12px;
        }

        .player-name {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .ranking-row strong {
          font-size: 24px;
          color: #c29cff;
        }

        .ranking-note {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
          color: #5e5966;
          font-size: 9px;
          letter-spacing: 0.15em;
        }

        .empty-state {
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #5e5966;
          text-align: center;
          letter-spacing: 0.18em;
          font-size: 9px;
        }

        .empty-state strong {
          color: #9c68ed;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .history-section {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .history-section h2 span {
          color: #9c68ed;
        }

        .history-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: end;
        }

        .history-big {
          display: flex;
          align-items: baseline;
          gap: 20px;
        }

        .history-big span {
          color: #5e5966;
          font-size: 20px;
          letter-spacing: 0.2em;
        }

        .history-big strong {
          font-size: clamp(100px, 18vw, 250px);
          line-height: 0.7;
          letter-spacing: -0.08em;
        }

        .history-text {
          max-width: 500px;
          color: #89838f;
          font-size: 15px;
          line-height: 1.9;
        }

        .history-text p {
          margin: 0 0 24px;
        }

        .about-section {
          position: relative;
          padding: 140px 32px 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(
              circle at 50% 20%,
              rgba(93, 42, 173, 0.16),
              transparent 35%
            ),
            #030305;
        }

        .about-inner {
          max-width: 900px;
          margin: 0 auto;
          text-align: center;
        }

        .about-logo {
          width: min(480px, 80vw);
          max-height: 220px;
          object-fit: contain;
          margin: 10px auto 35px;
        }

        .about-section h2 {
          margin: 0;
          font-size: clamp(48px, 8vw, 90px);
          line-height: 0.9;
          letter-spacing: -0.06em;
        }

        .about-copy {
          margin: 35px 0;
          color: #77717f;
          font-size: 10px;
          line-height: 2;
          letter-spacing: 0.25em;
        }

        .about-line {
          height: 1px;
          margin: 70px 0 25px;
          background: rgba(255, 255, 255, 0.1);
        }

        .footer-meta {
          display: flex;
          justify-content: space-between;
          color: #4e4a55;
          font-size: 8px;
          letter-spacing: 0.18em;
        }

        .modal-backdrop {
          position: fixed;
          z-index: 200;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.76);
          backdrop-filter: blur(14px);
          overflow-y: auto;
        }

        .detail-modal,
        .account-modal {
          position: relative;
          width: min(900px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          padding: 42px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background:
            radial-gradient(
              circle at 80% 0%,
              rgba(102, 52, 187, 0.2),
              transparent 34%
            ),
            #09090d;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55);
        }

        .account-modal {
          width: min(520px, 100%);
        }

        .close-button {
          position: absolute;
          top: 14px;
          right: 18px;
          border: 0;
          background: transparent;
          color: #8c8793;
          cursor: pointer;
          font-size: 32px;
          line-height: 1;
        }

        .close-button:hover {
          color: white;
        }

        .modal-kicker {
          margin-bottom: 16px;
          color: #9c68ed;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.24em;
        }

        .detail-modal h2,
        .account-modal h2 {
          margin: 0;
          max-width: 720px;
          font-size: clamp(34px, 6vw, 68px);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }

        .modal-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin: 25px 0 45px;
          color: #77717f;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .detail-block {
          margin-top: 34px;
        }

        .detail-title {
          padding-bottom: 14px;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: #5e5966;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.2em;
        }

        .detail-no-data,
        .modal-empty {
          padding: 36px 10px;
          color: #5e5966;
          text-align: center;
          font-size: 9px;
          letter-spacing: 0.18em;
        }

        .modal-empty {
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        .modal-empty strong {
          color: #9c68ed;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        .results-list,
        .team-list,
        .custom-list {
          display: grid;
          gap: 10px;
        }

        .result-card {
          display: grid;
          grid-template-columns: 70px 1fr;
          gap: 18px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
        }

        .result-rank {
          font-size: 34px;
          font-weight: 900;
          color: #9c68ed;
          letter-spacing: -0.06em;
        }

        .result-info {
          min-width: 0;
        }

        .result-info > strong {
          display: block;
          font-size: 20px;
        }

        .result-info > span {
          display: block;
          margin-top: 5px;
          color: #5e5966;
          font-size: 8px;
          letter-spacing: 0.15em;
        }

        .custom-box {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .custom-label {
          margin-bottom: 9px;
          color: #9c68ed;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.18em;
        }

        .data-list {
          display: grid;
          gap: 6px;
        }

        .data-line {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: #8c8793;
          font-size: 10px;
        }

        .data-key {
          min-width: 110px;
          color: #5e5966;
          text-transform: uppercase;
        }

        .data-value {
          color: #d6d2dc;
        }

        .team-card,
        .custom-registration {
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
        }

        .team-card > strong {
          font-size: 17px;
        }

        .team-members {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .team-members span {
          padding: 7px 9px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #8c8793;
          font-size: 9px;
        }

        .account-email {
          margin: 14px 0 30px;
          color: #77717f;
          font-size: 11px;
        }

        .account-block {
          display: grid;
          gap: 10px;
          margin-bottom: 20px;
        }

        .account-field {
          display: grid;
          gap: 8px;
          margin: 0 0 14px;
        }

        .account-field label,
        .account-block label {
          color: #5e5966;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.18em;
        }

        .account-field input,
        .account-block select, .account-block select option {
          width: 100%;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          outline: none;
          background: rgba(255, 255, 255, 0.035);
          color: white;
        }

        .account-field input:focus,
        .account-block select:focus {
          border-color: rgba(156, 104, 237, 0.7);
        }

        .account-message {
          margin: 18px 0 0;
          color: #b68aff;
          font-size: 9px;
          line-height: 1.6;
          letter-spacing: 0.08em;
        }

        @media (max-width: 800px) {
          .header-inner {
            height: 68px;
            padding: 0 20px;
          }

          .brand-logo {
            width: 105px;
          }

          .menu-button {
            display: block;
          }

          .nav {
            position: absolute;
            top: 68px;
            left: 0;
            right: 0;
            display: none;
            flex-direction: column;
            align-items: stretch;
            gap: 0;
            padding: 12px 20px 20px;
            background: rgba(5, 5, 7, 0.97);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }

          .nav-open {
            display: flex;
          }

          .nav button {
            padding: 18px 5px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .account-button {
            font-size: 8px;
          }

          .hero {
            padding-top: 110px;
          }

          .hero-logo {
            width: 80vw;
          }

          .hero-bottom {
            left: 20px;
            right: 20px;
          }

          .section {
            padding: 90px 20px;
          }

          .tournament-grid {
            grid-template-columns: 1fr;
          }

          .tournament-card {
            min-height: 260px;
          }

          .three-bey-grid {
            grid-template-columns: 1fr;
          }

          .ranking-head,
          .ranking-row {
            grid-template-columns: 55px 1fr 55px 55px 55px;
          }

          .ranking-head {
            font-size: 7px;
          }

          .ranking-row {
            min-height: 68px;
            font-size: 11px;
          }

          .player-name {
            font-size: 14px;
          }

          .ranking-row strong {
            font-size: 18px;
          }

          .history-content {
            grid-template-columns: 1fr;
            gap: 45px;
          }

          .history-big strong {
            font-size: 150px;
          }

          .ranking-note {
            gap: 15px;
            flex-direction: column;
          }

          .about-section {
            padding: 100px 20px 30px;
          }

          .footer-meta {
            gap: 15px;
            flex-direction: column;
          }

          .detail-modal,
          .account-modal {
            padding: 32px 20px 24px;
          }

          .result-card {
            grid-template-columns: 52px 1fr;
            padding: 15px;
          }

          .result-rank {
            font-size: 28px;
          }
        }
      `}</style>
    </main>
  );
}
