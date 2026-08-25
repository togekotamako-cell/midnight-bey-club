"use client";

import { useState } from "react";

const tournaments = [
  { date: "2026.09.12", title: "MIDNIGHT GRAND FINAL 2026", place: "KANAGAWA", status: "ENTRY OPEN" },
  { date: "2026.09.05", title: "MIDNIGHT CUP VOL.03", place: "YAMATO", status: "COMING SOON" },
  { date: "2026.08.29", title: "MIDNIGHT NIGHT BATTLE", place: "YOKOHAMA", status: "FULL" },
];

const ranking = [
  ["01", "BLADE MASTER", "128 PT"],
  ["02", "SPIN LORD", "116 PT"],
  ["03", "NIGHT FANG", "104 PT"],
  ["04", "DARK NOVA", "98 PT"],
  ["05", "ZERO GRAVITY", "91 PT"],
];

export default function Home() {
  const [menu, setMenu] = useState(false);

  return (
    <main className="site-shell">
      <div className="noise" />

      <header className="header">
        <a className="brand" href="#">
          <img src="/midnight-logo.png" alt="MIDNIGHT BEY CLUB" />
        </a>

        <nav className={menu ? "nav open" : "nav"}>
          <a href="#tournaments" onClick={() => setMenu(false)}>TOURNAMENTS</a>
          <a href="#ranking" onClick={() => setMenu(false)}>RANKING</a>
          <a href="#history" onClick={() => setMenu(false)}>HISTORY</a>
          <a href="#about" onClick={() => setMenu(false)}>ABOUT</a>
        </nav>

        <button
          className="menu-btn"
          onClick={() => setMenu(!menu)}
          aria-label="menu"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <section className="hero">
        <div className="hero-glow glow-a" />
        <div className="hero-glow glow-b" />

        <div className="hero-content">
          <p className="eyebrow">MIDNIGHT BEY CLUB / OFFICIAL WEB</p>

          <img
            className="hero-logo"
            src="/midnight-logo.png"
            alt="MIDNIGHT BEY CLUB"
          />

          <h1>
            NO SLEEP.
            <br />
            <span>KEEP SPIN.</span>
          </h1>

          <p className="hero-copy">
            大会情報、参加者、結果、ポイント、歴代ランキング。
            <br />
            MIDNIGHT BEY CLUBのすべてを、この場所に。
          </p>

          <div className="hero-actions">
            <a className="primary-btn" href="#tournaments">
              大会一覧を見る <b>↗</b>
            </a>

            <a className="ghost-btn" href="#ranking">
              ランキング <b>→</b>
            </a>
          </div>
        </div>

        <div className="spin-ring ring-one" />
        <div className="spin-ring ring-two" />
      </section>

      <section className="ticker">
        <div>NO SLEEP. KEEP SPIN.</div>
        <div>NO SLEEP. KEEP SPIN.</div>
        <div>NO SLEEP. KEEP SPIN.</div>
        <div>NO SLEEP. KEEP SPIN.</div>
      </section>

      <section id="tournaments" className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">NEXT BATTLES</p>
            <h2>TOURNAMENTS</h2>
          </div>

          <a href="#" className="text-link">
            VIEW ALL →
          </a>
        </div>

        <div className="tournament-grid">
          {tournaments.map((t, i) => (
            <article
              className={"t-card " + (i === 0 ? "featured" : "")}
              key={t.title}
            >
              <div className="card-top">
                <span>{t.date}</span>
                <span>{t.status}</span>
              </div>

              <div className="card-number">0{i + 1}</div>

              <h3>{t.title}</h3>
              <p>{t.place}</p>

              <div className="card-line" />

              <button>
                DETAILS <span>↗</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="ranking" className="section ranking-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">BLADE WARRIORS</p>
            <h2>RANKING</h2>
          </div>

          <a href="#" className="text-link">
            FULL RANKING →
          </a>
        </div>

        <div className="ranking-wrap">
          {ranking.map(([n, name, pts], i) => (
            <div
              className={"rank-row " + (i === 0 ? "rank-first" : "")}
              key={name}
            >
              <span className="rank-no">{n}</span>
              <span className="rank-name">{name}</span>
              <span className="rank-pts">{pts}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="history" className="statement">
        <p className="eyebrow">THE ARCHIVE</p>

        <h2>
          SPIN AFTER
          <br />
          <span>SPIN.</span>
        </h2>

        <p>
          真夜中の歴戦
        </p>
      </section>

      <footer id="about" className="footer">
        <img src="/midnight-logo.png" alt="" />

        <div>
          <strong>MIDNIGHT BEY CLUB</strong>
          <span>NO SLEEP. KEEP SPIN.</span>
        </div>

        <small>© 2026 MIDNIGHT BEY CLUB</small>
      </footer>
    </main>
  );
}
