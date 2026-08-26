"use client";

import { useEffect, useState } from "react";

type TournamentStatus = "ENTRY OPEN" | "UPCOMING" | "FINISHED";

type Tournament = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: TournamentStatus;
};

type Player = {
  id: string;
  rank: number;
  name: string;
  points: number;
  wins: number;
  tournaments: number;
};

const statusValues: TournamentStatus[] = [
  "ENTRY OPEN",
  "UPCOMING",
  "FINISHED",
];

export default function AdminPage() {
  const [tab, setTab] = useState<"tournaments" | "players">(
    "tournaments"
  );

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const getHeaders = () => ({
    apikey: supabaseKey || "",
    Authorization: `Bearer ${supabaseKey || ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  });

  const formatDateForInput = (value: string) => {
    if (!value) return "";

    return value
      .replace(/\./g, "-")
      .slice(0, 10);
  };

  const formatDateForDisplay = (value: string) => {
    if (!value) return "";

    return value
      .replace(/-/g, ".")
      .slice(0, 10);
  };

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          "Supabaseの環境変数が設定されていません"
        );
      }

      const baseUrl = supabaseUrl.replace(/\/$/, "");
      const headers = getHeaders();

      const tournamentsResponse = await fetch(
        `${baseUrl}/rest/v1/tournaments?select=id,name,tournament_date,location,status&order=tournament_date.asc`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      if (!tournamentsResponse.ok) {
        const text = await tournamentsResponse.text();

        throw new Error(
          `TOURNAMENT LOAD ERROR (${tournamentsResponse.status}): ${text}`
        );
      }

      const tournamentData = await tournamentsResponse.json();

      const normalizedTournaments: Tournament[] =
        (tournamentData || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || "",
          date: formatDateForDisplay(
            item.tournament_date || ""
          ),
          location: item.location || "",
          status:
            statusValues.includes(item.status)
              ? item.status
              : "UPCOMING",
        }));

      setTournaments(normalizedTournaments);

      const playersResponse = await fetch(
        `${baseUrl}/rest/v1/players?select=id,name,rank,points,wins,tournaments&order=rank.asc.nullslast,created_at.asc`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      if (!playersResponse.ok) {
        const text = await playersResponse.text();

        throw new Error(
          `PLAYER LOAD ERROR (${playersResponse.status}): ${text}`
        );
      }

      const playerData = await playersResponse.json();

      const normalizedPlayers: Player[] =
        (playerData || []).map(
          (item: any, index: number) => ({
            id: String(item.id),
            rank:
              item.rank !== null &&
              item.rank !== undefined
                ? Number(item.rank)
                : index + 1,
            name: item.name || "",
            points: Number(item.points || 0),
            wins: Number(item.wins || 0),
            tournaments: Number(
              item.tournaments || 0
            ),
          })
        );

      setPlayers(normalizedPlayers);
    } catch (error) {
      console.error("LOAD ERROR:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(`ERROR: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateTournament = (
    id: string,
    field: keyof Tournament,
    value: string
  ) => {
    setTournaments((current) =>
      current.map((tournament) =>
        tournament.id === id
          ? {
              ...tournament,
              [field]: value,
            }
          : tournament
      )
    );
  };

  const updatePlayer = (
    id: string,
    field: keyof Player,
    value: string
  ) => {
    setPlayers((current) =>
      current.map((player) => {
        if (player.id !== id) {
          return player;
        }

        if (field === "name") {
          return {
            ...player,
            name: value,
          };
        }

        return {
          ...player,
          [field]: Number(value),
        };
      })
    );
  };

  const saveTournaments = async () => {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabaseの環境変数が設定されていません"
      );
    }

    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const headers = getHeaders();

    for (const tournament of tournaments) {
      if (!tournament.id) continue;

      const response = await fetch(
        `${baseUrl}/rest/v1/tournaments?id=eq.${encodeURIComponent(
          tournament.id
        )}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            name: tournament.name,
            tournament_date:
              tournament.date
                .replace(/\./g, "-")
                .slice(0, 10),
            location: tournament.location,
            status: tournament.status,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          `TOURNAMENT SAVE ERROR (${response.status}): ${text}`
        );
      }
    }
  };

  const savePlayers = async () => {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabaseの環境変数が設定されていません"
      );
    }

    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const headers = getHeaders();

    for (const player of players) {
      if (!player.id) continue;

      const response = await fetch(
        `${baseUrl}/rest/v1/players?id=eq.${encodeURIComponent(
          player.id
        )}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            name: player.name,
            points: Number(player.points) || 0,
            wins: Number(player.wins) || 0,
            tournaments:
              Number(player.tournaments) || 0,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          `PLAYER SAVE ERROR (${response.status}): ${text}`
        );
      }
    }
  };

  const saveChanges = async () => {
    if (saving) return;

    setSaving(true);
    setMessage("SAVING...");

    try {
      if (tab === "tournaments") {
        await saveTournaments();
      } else {
        await savePlayers();
      }

      setMessage("SAVED");

      await loadData();

      setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error) {
      console.error("SAVE ERROR:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(`ERROR: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin">
      <header className="adminHeader">
        <div>
          <div className="eyebrow">
            MIDNIGHT BEY CLUB
          </div>

          <h1>ADMIN</h1>

          <p>
            TOURNAMENT / PLAYER MANAGEMENT
          </p>
        </div>

        <a href="/" className="back">
          BACK TO SITE ↗
        </a>
      </header>

      <nav className="tabs">
        <button
          className={
            tab === "tournaments"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("tournaments")
          }
        >
          TOURNAMENTS
        </button>

        <button
          className={
            tab === "players"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("players")
          }
        >
          RANKING
        </button>
      </nav>

      <section className="panel">
        {loading ? (
          <div className="loading">
            LOADING DATABASE...
          </div>
        ) : (
          <>
            {tab === "tournaments" && (
              <>
                <div className="sectionTitle">
                  <span>NEXT BATTLES</span>
                  <h2>TOURNAMENTS</h2>
                </div>

                {tournaments.length === 0 ? (
                  <div className="empty">
                    NO TOURNAMENTS FOUND
                  </div>
                ) : (
                  <div className="cards">
                    {tournaments.map(
                      (tournament) => (
                        <article
                          className="card"
                          key={tournament.id}
                        >
                          <label>
                            TOURNAMENT NAME

                            <input
                              value={
                                tournament.name
                              }
                              onChange={(e) =>
                                updateTournament(
                                  tournament.id,
                                  "name",
                                  e.target.value
                                )
                              }
                            />
                          </label>

                          <label>
                            DATE

                            <input
                              type="date"
                              value={formatDateForInput(
                                tournament.date
                              )}
                              onChange={(e) =>
                                updateTournament(
                                  tournament.id,
                                  "date",
                                  formatDateForDisplay(
                                    e.target.value
                                  )
                                )
                              }
                            />
                          </label>

                          <label>
                            LOCATION

                            <input
                              value={
                                tournament.location
                              }
                              onChange={(e) =>
                                updateTournament(
                                  tournament.id,
                                  "location",
                                  e.target.value
                                )
                              }
                            />
                          </label>

                          <label>
                            STATUS

                            <select
                              value={
                                tournament.status
                              }
                              onChange={(e) =>
                                updateTournament(
                                  tournament.id,
                                  "status",
                                  e.target.value
                                )
                              }
                            >
                              <option value="ENTRY OPEN">
                                ENTRY OPEN
                              </option>

                              <option value="UPCOMING">
                                UPCOMING
                              </option>

                              <option value="FINISHED">
                                FINISHED
                              </option>
                            </select>
                          </label>

                          <div className="id">
                            ID:{" "}
                            {tournament.id}
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
              </>
            )}

            {tab === "players" && (
              <>
                <div className="sectionTitle">
                  <span>THE NUMBERS</span>
                  <h2>RANKING</h2>
                </div>

                {players.length === 0 ? (
                  <div className="empty">
                    NO PLAYERS FOUND
                  </div>
                ) : (
                  <div className="playerList">
                    {players.map((player) => (
                      <div
                        className="player"
                        key={player.id}
                      >
                        <div className="rank">
                          {String(
                            player.rank
                          ).padStart(2, "0")}
                        </div>

                        <label>
                          PLAYER

                          <input
                            value={player.name}
                            onChange={(e) =>
                              updatePlayer(
                                player.id,
                                "name",
                                e.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          POINTS

                          <input
                            type="number"
                            value={player.points}
                            onChange={(e) =>
                              updatePlayer(
                                player.id,
                                "points",
                                e.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          WINS

                          <input
                            type="number"
                            value={player.wins}
                            onChange={(e) =>
                              updatePlayer(
                                player.id,
                                "wins",
                                e.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          EVENTS

                          <input
                            type="number"
                            value={
                              player.tournaments
                            }
                            onChange={(e) =>
                              updatePlayer(
                                player.id,
                                "tournaments",
                                e.target.value
                              )
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="saveArea">
          {message && (
            <span
              className={
                message.startsWith("ERROR")
                  ? "saved error"
                  : "saved"
              }
            >
              {message}
            </span>
          )}

          <button
            className="save"
            onClick={saveChanges}
            disabled={saving || loading}
          >
            {saving
              ? "SAVING..."
              : "SAVE CHANGES"}
          </button>
        </div>
      </section>

      <style jsx>{`
        .admin {
          min-height: 100vh;
          background: #08060d;
          color: #f4f1f8;
          padding: 70px 7vw;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        .adminHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 1px solid #292331;
          padding-bottom: 35px;
        }

        .eyebrow,
        .sectionTitle span {
          font-size: 11px;
          letter-spacing: 4px;
          color: #a99ab9;
        }

        h1 {
          font-size: 72px;
          margin: 10px 0 5px;
          letter-spacing: -3px;
        }

        .adminHeader p {
          margin: 0;
          color: #8d8398;
          letter-spacing: 3px;
          font-size: 11px;
        }

        .back {
          color: #f4f1f8;
          text-decoration: none;
          border: 1px solid #40364d;
          padding: 15px 20px;
          font-size: 11px;
          letter-spacing: 2px;
        }

        .tabs {
          display: flex;
          gap: 10px;
          margin: 35px 0;
        }

        .tabs button {
          background: transparent;
          color: #8d8398;
          border: 1px solid #292331;
          padding: 14px 22px;
          cursor: pointer;
          letter-spacing: 2px;
          font-size: 11px;
        }

        .tabs button.active {
          color: white;
          border-color: #9d6cff;
          background: #171020;
        }

        .panel {
          border: 1px solid #292331;
          background: #0c0912;
          padding: 40px;
        }

        .sectionTitle h2 {
          font-size: 52px;
          margin: 12px 0 35px;
          letter-spacing: -2px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 18px;
        }

        .card {
          border: 1px solid #292331;
          padding: 25px;
          background: #100c18;
        }

        label {
          display: block;
          color: #8d8398;
          font-size: 10px;
          letter-spacing: 2px;
          margin-bottom: 18px;
        }

        input,
        select {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin-top: 8px;
          background: #08060d;
          border: 1px solid #342b40;
          color: white;
          padding: 13px;
          outline: none;
        }

        input:focus,
        select:focus {
          border-color: #9d6cff;
        }

        .id {
          margin-top: 5px;
          color: #51485c;
          font-size: 9px;
          line-height: 1.5;
          word-break: break-all;
        }

        .playerList {
          border-top: 1px solid #292331;
        }

        .player {
          display: grid;
          grid-template-columns:
            70px
            2fr
            1fr
            1fr
            1fr;
          gap: 20px;
          align-items: end;
          padding: 25px 0 5px;
          border-bottom: 1px solid #292331;
        }

        .rank {
          font-size: 24px;
          color: #9d6cff;
          padding-bottom: 18px;
        }

        .saveArea {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 20px;
          margin-top: 35px;
        }

        .saved {
          color: #9d6cff;
          font-size: 11px;
          letter-spacing: 2px;
          max-width: 700px;
          word-break: break-word;
        }

        .saved.error {
          color: #ff6b81;
        }

        .save {
          border: 0;
          background: #f4f1f8;
          color: #08060d;
          padding: 16px 28px;
          font-weight: bold;
          letter-spacing: 2px;
          cursor: pointer;
          white-space: nowrap;
        }

        .save:hover:not(:disabled) {
          background: #9d6cff;
          color: white;
        }

        .save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading,
        .empty {
          padding: 80px 20px;
          text-align: center;
          color: #8d8398;
          letter-spacing: 3px;
          font-size: 11px;
        }

        @media (max-width: 900px) {
          .cards {
            grid-template-columns: 1fr;
          }

          .player {
            grid-template-columns: 1fr;
          }

          .adminHeader {
            display: block;
          }

          .back {
            display: inline-block;
            margin-top: 25px;
          }

          .panel {
            padding: 20px;
          }

          h1 {
            font-size: 52px;
          }

          .saveArea {
            display: block;
          }

          .saved {
            display: block;
            margin-bottom: 15px;
          }
        }
      `}</style>
    </main>
  );
}
