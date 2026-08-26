"use client";

import { useState } from "react";

type Tournament = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: "ENTRY OPEN" | "UPCOMING" | "FINISHED";
};

type Player = {
  rank: number;
  name: string;
  points: number;
  wins: number;
  tournaments: number;
};

const initialTournaments: Tournament[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "MIDNIGHT BEY CLUB #01",
    date: "2026.09.12",
    location: "KANAGAWA",
    status: "ENTRY OPEN",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "MIDNIGHT BEY CLUB #02",
    date: "2026.10.10",
    location: "YOKOHAMA",
    status: "UPCOMING",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "MIDNIGHT BEY CLUB #00",
    date: "2026.08.09",
    location: "YAMATO",
    status: "FINISHED",
  },
];

const initialPlayers: Player[] = [
  {
    rank: 1,
    name: "PLAYER 01",
    points: 18,
    wins: 5,
    tournaments: 7,
  },
  {
    rank: 2,
    name: "PLAYER 02",
    points: 14,
    wins: 4,
    tournaments: 6,
  },
  {
    rank: 3,
    name: "PLAYER 03",
    points: 11,
    wins: 3,
    tournaments: 5,
  },
  {
    rank: 4,
    name: "PLAYER 04",
    points: 8,
    wins: 2,
    tournaments: 4,
  },
  {
    rank: 5,
    name: "PLAYER 05",
    points: 6,
    wins: 1,
    tournaments: 3,
  },
];

export default function AdminPage() {
  const [tab, setTab] = useState<"tournaments" | "players">(
    "tournaments"
  );

  const [tournaments, setTournaments] =
    useState<Tournament[]>(initialTournaments);

  const [players, setPlayers] =
    useState<Player[]>(initialPlayers);

  const [message, setMessage] = useState("");

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
    rank: number,
    field: keyof Player,
    value: string
  ) => {
    setPlayers((current) =>
      current.map((player) =>
        player.rank === rank
          ? {
              ...player,
              [field]:
                field === "name"
                  ? value
                  : Number(value),
            }
          : player
      )
    );
  };

  const saveChanges = async () => {
    setMessage("SAVING...");

    try {
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL;

      const supabaseKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl) {
        throw new Error(
          "NEXT_PUBLIC_SUPABASE_URL が設定されていません"
        );
      }

      if (!supabaseKey) {
        throw new Error(
          "NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません"
        );
      }

      const baseUrl = supabaseUrl.replace(/\/$/, "");

      const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=minimal",
      };

      /*
       * --------------------------------
       * TOURNAMENTS
       * --------------------------------
       */

      for (const tournament of tournaments) {
        // Supabase column is `tournament_date`, and `id` is UUID.
        // Upsert also works when the table is currently empty.
        const response = await fetch(
          `${baseUrl}/rest/v1/tournaments?on_conflict=id`,
          {
            method: "POST",
            headers: {
              ...headers,
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify({
              id: tournament.id,
              name: tournament.name,
              tournament_date: tournament.date.replace(/\\./g, "-"),
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

      /*
       * --------------------------------
       * PLAYERS
       * --------------------------------
       */

      for (const player of players) {
        const response = await fetch(
          `${baseUrl}/rest/v1/players?rank=eq.${player.rank}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              name: player.name,
              points: player.points,
              wins: player.wins,
              tournaments: player.tournaments,
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

      /*
       * --------------------------------
       * LOCAL STORAGE
       * --------------------------------
       */

      localStorage.setItem(
        "midnight_tournaments",
        JSON.stringify(tournaments)
      );

      localStorage.setItem(
        "midnight_players",
        JSON.stringify(players)
      );

      setMessage("SAVED");

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
            tab === "tournaments" ? "active" : ""
          }
          onClick={() =>
            setTab("tournaments")
          }
        >
          TOURNAMENTS
        </button>

        <button
          className={
            tab === "players" ? "active" : ""
          }
          onClick={() =>
            setTab("players")
          }
        >
          RANKING
        </button>
      </nav>

      <section className="panel">
        {tab === "tournaments" && (
          <>
            <div className="sectionTitle">
              <span>NEXT BATTLES</span>

              <h2>TOURNAMENTS</h2>
            </div>

            <div className="cards">
              {tournaments.map((tournament) => (
                <article
                  className="card"
                  key={tournament.id}
                >
                  <label>
                    TOURNAMENT NAME

                    <input
                      value={tournament.name}
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
                      value={tournament.date}
                      onChange={(e) =>
                        updateTournament(
                          tournament.id,
                          "date",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    LOCATION

                    <input
                      value={tournament.location}
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
                      value={tournament.status}
                      onChange={(e) =>
                        updateTournament(
                          tournament.id,
                          "status",
                          e.target.value
                        )
                      }
                    >
                      <option>
                        ENTRY OPEN
                      </option>

                      <option>
                        UPCOMING
                      </option>

                      <option>
                        FINISHED
                      </option>
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "players" && (
          <>
            <div className="sectionTitle">
              <span>THE NUMBERS</span>

              <h2>RANKING</h2>
            </div>

            <div className="playerList">
              {players.map((player) => (
                <div
                  className="player"
                  key={player.rank}
                >
                  <div className="rank">
                    {String(player.rank).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  <label>
                    PLAYER

                    <input
                      value={player.name}
                      onChange={(e) =>
                        updatePlayer(
                          player.rank,
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
                          player.rank,
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
                          player.rank,
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
                          player.rank,
                          "tournaments",
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
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
          >
            SAVE CHANGES
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

        .save:hover {
          background: #9d6cff;
          color: white;
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
