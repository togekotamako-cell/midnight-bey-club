"use client";

import { useState } from "react";

type Tournament = {
  id: number;
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

const tournaments: Tournament[] = [
  {
    id: 1,
    name: "MIDNIGHT BEY CLUB #01",
    date: "2026.09.12",
    location: "KANAGAWA",
    status: "ENTRY OPEN",
  },
  {
    id: 2,
    name: "MIDNIGHT BEY CLUB #02",
    date: "2026.10.10",
    location: "YOKOHAMA",
    status: "UPCOMING",
  },
  {
    id: 3,
    name: "MIDNIGHT BEY CLUB #00",
    date: "2026.08.09",
    location: "YAMATO",
    status: "FINISHED",
  },
];

const players: Player[] = [
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

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMenuOpen(false);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
    });
  };

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

            <button onClick={() => scrollTo("ranking")}>
              RANKING
            </button>

            <button onClick={() => scrollTo("history")}>
              HISTORY
            </button>

            <button onClick={() => scrollTo("about")}>
              ABOUT
            </button>
          </nav>

          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <section id="home" className="hero">
        <div className="hero-glow" />

        <div className="hero-content">
          <p className="eyebrow">
            MIDNIGHT BEY CLUB / OFFICIAL WEB
          </p>

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
          {tournaments.map((tournament) => (
            <article
              className="tournament-card"
              key={tournament.id}
            >
              <div className="card-top">
                <span
                  className={`status ${
                    tournament.status === "ENTRY OPEN"
                      ? "open"
                      : ""
                  }`}
                >
                  {tournament.status}
                </span>

                <span>
                  #{String(tournament.id).padStart(2, "0")}
                </span>
              </div>

              <div className="card-main">
                <p className="date">{tournament.date}</p>

                <h3>{tournament.name}</h3>

                <p className="location">
                  {tournament.location}
                </p>
              </div>

              <div className="card-arrow">↗</div>
            </article>
          ))}
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

        <div className="ranking-table">
          <div className="ranking-head">
            <span>RANK</span>
            <span>PLAYER</span>
            <span>WINS</span>
            <span>EVENTS</span>
            <span>PTS</span>
          </div>

          {players.map((player) => (
            <div
              className="ranking-row"
              key={player.name}
            >
              <span className="rank">
                {String(player.rank).padStart(2, "0")}
              </span>

              <span className="player-name">
                {player.name}
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
            <strong>01</strong>
          </div>

          <div className="history-text">
            <p>
              MIDNIGHT BEY CLUB is a Beyblade X community
              built around competition, records and the people
              who keep the stadium spinning.
            </p>

            <p>
              Every tournament becomes part of the archive.
              Every battle leaves a record.
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="about-section">
        <div className="about-inner">
          <p className="eyebrow">
            MIDNIGHT BEY CLUB
          </p>

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
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        button {
          font: inherit;
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
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
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
          gap: 36px;
          align-items: center;
        }

        .nav button {
          border: 0;
          background: transparent;
          color: #aaa6b2;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          transition: 0.25s;
        }

        .nav button:hover {
          color: white;
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
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
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
          gap: 24px;
          padding: 16px 22px;
          border: 1px solid
            rgba(255, 255, 255, 0.22);
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

        .primary-button span {
          font-size: 18px;
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
          grid-template-columns:
            repeat(3, 1fr);
          gap: 14px;
        }

        .tournament-card {
          position: relative;
          min-height: 330px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          background:
            linear-gradient(
              145deg,
              rgba(101, 49, 180, 0.14),
              rgba(255, 255, 255, 0.025)
            );
          transition: 0.3s;
        }

        .tournament-card:hover {
          transform: translateY(-5px);
          border-color: rgba(
            145,
            93,
            230,
            0.5
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

        .ranking-section {
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .ranking-table {
          border-top: 1px solid
            rgba(255, 255, 255, 0.12);
        }

        .ranking-head,
        .ranking-row {
          display: grid;
          grid-template-columns:
            100px 1fr 120px 120px 100px;
          align-items: center;
        }

        .ranking-head {
          min-height: 48px;
          color: #5e5966;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .ranking-row {
          min-height: 82px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
          transition: 0.2s;
        }

        .ranking-row:hover {
          background: rgba(
            116,
            64,
            201,
            0.08
          );
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

        .history-section {
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
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
          font-size: clamp(
            100px,
            18vw,
            250px
          );
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
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
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
          font-size: clamp(
            48px,
            8vw,
            90px
          );
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
          background: rgba(
            255,
            255,
            255,
            0.1
          );
        }

        .footer-meta {
          display: flex;
          justify-content: space-between;
          color: #4e4a55;
          font-size: 8px;
          letter-spacing: 0.18em;
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
            background: rgba(
              5,
              5,
              7,
              0.97
            );
            border-bottom: 1px solid
              rgba(255, 255, 255, 0.08);
          }

          .nav-open {
            display: flex;
          }

          .nav button {
            padding: 18px 5px;
            text-align: left;
            border-bottom: 1px solid
              rgba(255, 255, 255, 0.06);
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

          .ranking-head,
          .ranking-row {
            grid-template-columns:
              55px 1fr 55px 55px 55px;
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
        }
      `}</style>
    </main>
  );
}
