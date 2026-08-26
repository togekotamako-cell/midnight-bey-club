"use client";

import { useState } from "react";

type Tournament = {
  id: number;
  name: string;
  date: string;
  location: string;
};

type Player = {
  id: number;
  name: string;
};

export default function AdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([
    {
      id: 1,
      name: "MIDNIGHT BEY CLUB #01",
      date: "2026.09.12",
      location: "KANAGAWA",
    },
  ]);

  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: "PLAYER 01" },
    { id: 2, name: "PLAYER 02" },
  ]);

  const [newTournament, setNewTournament] = useState({
    name: "",
    date: "",
    location: "",
  });

  const [newPlayer, setNewPlayer] = useState("");

  const addTournament = () => {
    if (!newTournament.name.trim()) return;

    setTournaments([
      ...tournaments,
      {
        id: Date.now(),
        ...newTournament,
      },
    ]);

    setNewTournament({
      name: "",
      date: "",
      location: "",
    });
  };

  const addPlayer = () => {
    if (!newPlayer.trim()) return;

    setPlayers([
      ...players,
      {
        id: Date.now(),
        name: newPlayer,
      },
    ]);

    setNewPlayer("");
  };

  const deleteTournament = (id: number) => {
    setTournaments(tournaments.filter((t) => t.id !== id));
  };

  const deletePlayer = (id: number) => {
    setPlayers(players.filter((p) => p.id !== id));
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07050c",
        color: "#f5f2ff",
        padding: "50px 6%",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 50 }}>
          <p
            style={{
              letterSpacing: "4px",
              fontSize: 12,
              color: "#9c7cff",
            }}
          >
            MIDNIGHT BEY CLUB / ADMIN
          </p>

          <h1
            style={{
              fontSize: 52,
              margin: "10px 0",
              letterSpacing: "-2px",
            }}
          >
            ADMIN PANEL
          </h1>

          <p style={{ color: "#999", marginTop: 10 }}>
            大会・選手・結果を管理するページ
          </p>
        </div>

        {/* TOURNAMENTS */}
        <section
          style={{
            border: "1px solid #292035",
            background: "#0d0915",
            padding: 30,
            marginBottom: 30,
          }}
        >
          <h2 style={{ marginTop: 0 }}>TOURNAMENTS</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr auto",
              gap: 10,
              marginBottom: 25,
            }}
          >
            <input
              placeholder="大会名"
              value={newTournament.name}
              onChange={(e) =>
                setNewTournament({
                  ...newTournament,
                  name: e.target.value,
                })
              }
            />

            <input
              placeholder="日付"
              value={newTournament.date}
              onChange={(e) =>
                setNewTournament({
                  ...newTournament,
                  date: e.target.value,
                })
              }
            />

            <input
              placeholder="開催地"
              value={newTournament.location}
              onChange={(e) =>
                setNewTournament({
                  ...newTournament,
                  location: e.target.value,
                })
              }
            />

            <button onClick={addTournament}>ADD</button>
          </div>

          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #211a2d",
                padding: "18px 0",
              }}
            >
              <div>
                <strong>{tournament.name}</strong>
                <div style={{ color: "#888", marginTop: 5 }}>
                  {tournament.date} / {tournament.location}
                </div>
              </div>

              <button onClick={() => deleteTournament(tournament.id)}>
                DELETE
              </button>
            </div>
          ))}
        </section>

        {/* PLAYERS */}
        <section
          style={{
            border: "1px solid #292035",
            background: "#0d0915",
            padding: 30,
            marginBottom: 30,
          }}
        >
          <h2 style={{ marginTop: 0 }}>PLAYERS</h2>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 25,
            }}
          >
            <input
              style={{ flex: 1 }}
              placeholder="選手名"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
            />

            <button onClick={addPlayer}>ADD</button>
          </div>

          {players.map((player) => (
            <div
              key={player.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #211a2d",
                padding: "18px 0",
              }}
            >
              <strong>{player.name}</strong>

              <button onClick={() => deletePlayer(player.id)}>
                DELETE
              </button>
            </div>
          ))}
        </section>

        {/* RESULTS */}
        <section
          style={{
            border: "1px solid #292035",
            background: "#0d0915",
            padding: 30,
          }}
        >
          <h2 style={{ marginTop: 0 }}>RESULTS</h2>

          <p style={{ color: "#888" }}>
            次の段階でここに大会結果入力とポイント自動計算を追加します。
          </p>

          <div
            style={{
              padding: 20,
              border: "1px dashed #392b50",
              color: "#9c7cff",
            }}
          >
            1位 → 3pt　/　2位 → 2pt　/　3位 → 1pt
            <br />
            チーム戦 → 1位 2pt / 2位 1pt
          </div>
        </section>
      </div>
    </main>
  );
}
