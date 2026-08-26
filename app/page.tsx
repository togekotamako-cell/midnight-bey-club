function doGet() {
  return HtmlService
    .createHtmlOutputFromFile("index")
    .setTitle("夜更かしベイブレぇど")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/* =========================
   初期設定
========================= */

function setupTournament() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = ["大会", "選手", "対戦", "順位", "設定"];

  names.forEach(function(name) {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });

  const tournament = ss.getSheetByName("大会");
  const players = ss.getSheetByName("選手");
  const matches = ss.getSheetByName("対戦");
  const ranking = ss.getSheetByName("順位");
  const settings = ss.getSheetByName("設定");

  tournament.clear();
  players.clear();
  matches.clear();
  ranking.clear();
  settings.clear();

  tournament.getRange("A1:B10").setValues([
    ["夜更かしベイブレぇど", ""],
    ["大会名", "夜更かしベイブレぇど"],
    ["開催日", ""],
    ["参加人数", 0],
    ["ラウンド数", 0],
    ["勝利条件", 4],
    ["最大記録点", 6],
    ["大会状態", "準備中"],
    ["現在ラウンド", 0],
    ["作成日時", new Date()]
  ]);

  players.getRange(1, 1, 1, 7).setValues([[
    "No.", "選手名", "勝", "敗", "得点", "失点", "得失点差"
  ]]);

  for (let i = 1; i <= 30; i++) {
    players.getRange(i + 1, 1).setValue(i);
  }

  matches.getRange(1, 1, 1, 11).setValues([[
    "Round", "試合No.", "選手A", "選手B", "A得点", "B得点",
    "勝者", "状態", "Aフィニッシュ", "Bフィニッシュ", "備考"
  ]]);

  ranking.getRange(1, 1, 1, 8).setValues([[
    "順位", "選手名", "勝", "敗", "得点", "失点", "得失点差", "勝率"
  ]]);

  settings.getRange(1, 2, 8, 2).setValues([
    ["設定値", "内容"],
    [30, "最大参加人数"],
    [4, "勝利条件"],
    [6, "最大記録点"],
    [1, "スピンフィニッシュ"],
    [2, "オーバーフィニッシュ"],
    [2, "バーストフィニッシュ"],
    [3, "エクストリームフィニッシュ"]
  ]);

  formatSheets();
  return "初期設定が完了しました！";
}

function formatSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ["大会", "選手", "対戦", "順位", "設定"].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheet.getDataRange().setVerticalAlignment("middle");
    if (sheet.getLastColumn() > 0) {
      sheet.autoResizeColumns(1, sheet.getLastColumn());
    }
  });
}

/* =========================
   大会情報
========================= */

function getTournamentInfo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("大会");
  if (!sheet) throw new Error("先にsetupTournamentを実行してください。");

  return {
    name: String(sheet.getRange("B2").getValue() || ""),
    date: String(sheet.getRange("B3").getDisplayValue() || ""),
    players: Number(sheet.getRange("B4").getValue()) || 0,
    rounds: Number(sheet.getRange("B5").getValue()) || 0,
    winCondition: Number(sheet.getRange("B6").getValue()) || 4,
    maxRecord: Number(sheet.getRange("B7").getValue()) || 6,
    status: String(sheet.getRange("B8").getValue() || "準備中"),
    round: Number(sheet.getRange("B9").getValue()) || 0
  };
}

function setTournamentInfo(name, dateText, rounds) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("大会");
  if (!sheet) throw new Error("先に初期設定を実行してください。");

  const status = String(sheet.getRange("B8").getValue() || "準備中");
  if (status !== "準備中") {
    throw new Error("大会開始後は大会設定を変更できません。");
  }

  name = String(name || "").trim();
  dateText = String(dateText || "").trim();
  rounds = Number(rounds) || 0;

  if (!name) throw new Error("大会名を入力してください。");
  if (rounds < 1 || rounds > 20) {
    throw new Error("ラウンド数は1〜20で設定してください。");
  }

  sheet.getRange("B2").setValue(name);
  sheet.getRange("B3").setValue(dateText);
  sheet.getRange("B5").setValue(rounds);

  return getTournamentInfo();
}

/* =========================
   選手
========================= */

function getPlayers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("選手");
  const data = sheet.getRange(2, 1, 30, 7).getValues();
  return data
    .filter(function(row) { return String(row[1]).trim() !== ""; })
    .map(function(row) { return String(row[1]).trim(); });
}

function getRegisteredPlayers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("選手");
  const data = sheet.getRange(2, 2, 30, 1).getValues();

  return data
    .map(function(row, index) {
      return { no: index + 1, name: String(row[0] || "").trim() };
    })
    .filter(function(player) { return player.name !== ""; });
}

function registerPlayer(name) {
  const tournament = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("大会");
  const status = String(tournament.getRange("B8").getValue() || "準備中");

  if (status !== "準備中") {
    throw new Error("大会開始後は選手を変更できません。");
  }

  name = String(name || "").trim();
  if (!name) throw new Error("選手名を入力してください。");
  if (name.length > 20) throw new Error("選手名は20文字以内です。");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("選手");
  const data = sheet.getRange(2, 2, 30, 1).getValues();
  const players = data
    .map(function(row) { return String(row[0] || "").trim(); })
    .filter(function(value) { return value !== ""; });

  if (players.length >= 30) throw new Error("参加人数は最大30人です。");
  if (players.includes(name)) throw new Error("同じ名前の選手がすでに登録されています。");

  sheet.getRange(players.length + 2, 2).setValue(name);
  return getRegisteredPlayers();
}

function removePlayer(no) {
  const tournament = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("大会");
  const status = String(tournament.getRange("B8").getValue() || "準備中");

  if (status !== "準備中") {
    throw new Error("大会開始後は選手を変更できません。");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("選手");
  const row = Number(no) + 1;
  if (row < 2 || row > 31) throw new Error("選手番号が正しくありません。");

  sheet.getRange(row, 2).clearContent();

  const players = sheet.getRange(2, 2, 30, 1).getValues()
    .map(function(row) { return String(row[0] || "").trim(); })
    .filter(function(name) { return name !== ""; });

  sheet.getRange(2, 2, 30, 1).clearContent();
  if (players.length) {
    sheet.getRange(2, 2, players.length, 1)
      .setValues(players.map(function(name) { return [name]; }));
  }

  return getRegisteredPlayers();
}

/* =========================
   大会開始・リセット
========================= */

function startTournament() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tournament = ss.getSheetByName("大会");
  const matches = ss.getSheetByName("対戦");
  const playersSheet = ss.getSheetByName("選手");

  const status = String(tournament.getRange("B8").getValue() || "準備中");
  if (status !== "準備中") {
    throw new Error("この大会はすでに開始されています。");
  }

  const players = getPlayers();
  if (players.length < 2) throw new Error("選手を2人以上登録してください。");
  if (players.length > 30) throw new Error("参加人数は最大30人です。");

  const configuredRounds = Number(tournament.getRange("B5").getValue()) || 0;
  if (configuredRounds < 1) throw new Error("先にラウンド数を設定してください。");

  matches.clear();
  matches.getRange(1, 1, 1, 11).setValues([[
    "Round", "試合No.", "選手A", "選手B", "A得点", "B得点",
    "勝者", "状態", "Aフィニッシュ", "Bフィニッシュ", "備考"
  ]]);

  for (let i = 2; i <= 31; i++) {
    playersSheet.getRange(i, 3, 1, 5).setValues([[0, 0, 0, 0, 0]]);
  }

  tournament.getRange("B4").setValue(players.length);
  tournament.getRange("B8").setValue("開催中");
  tournament.getRange("B9").setValue(1);

  createRound(1);
  updateRanking();

  return "ROUND 1を開始しました！";
}

function resetTournament() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tournament = ss.getSheetByName("大会");
  const players = ss.getSheetByName("選手");
  const matches = ss.getSheetByName("対戦");
  const ranking = ss.getSheetByName("順位");

  const status = String(tournament.getRange("B8").getValue() || "準備中");
  if (status === "開催中") {
    throw new Error("開催中の大会はリセットできません。先に大会を終了してください。");
  }

  matches.clear();
  matches.getRange(1, 1, 1, 11).setValues([[
    "Round", "試合No.", "選手A", "選手B", "A得点", "B得点",
    "勝者", "状態", "Aフィニッシュ", "Bフィニッシュ", "備考"
  ]]);

  players.getRange(2, 3, 30, 5).setValues(
    Array.from({length: 30}, function() { return [0, 0, 0, 0, 0]; })
  );

  ranking.clear();
  ranking.getRange(1, 1, 1, 8).setValues([[
    "順位", "選手名", "勝", "敗", "得点", "失点", "得失点差", "勝率"
  ]]);

  tournament.getRange("B4").setValue(getPlayers().length);
  tournament.getRange("B8").setValue("準備中");
  tournament.getRange("B9").setValue(0);

  return getTournamentInfo();
}

/* =========================
   ラウンド生成
========================= */

function createRound(roundNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playersSheet = ss.getSheetByName("選手");
  const matchesSheet = ss.getSheetByName("対戦");

  const data = playersSheet.getRange(2, 1, 30, 7).getValues();
  const players = data
    .filter(function(row) { return String(row[1]).trim() !== ""; })
    .map(function(row) {
      return {
        name: String(row[1]).trim(),
        wins: Number(row[2]) || 0,
        losses: Number(row[3]) || 0,
        diff: Number(row[6]) || 0
      };
    });

  if (players.length < 2) throw new Error("選手が2人以上必要です。");

  const history = {};
  players.forEach(function(player) { history[player.name] = []; });

  const lastRow = matchesSheet.getLastRow();
  if (lastRow >= 2) {
    const oldMatches = matchesSheet.getRange(2, 1, lastRow - 1, 11).getValues();
    oldMatches.forEach(function(row) {
      const a = row[2], b = row[3];
      if (!a || !b || b === "BYE") return;
      if (history[a]) history[a].push(b);
      if (history[b]) history[b].push(a);
    });
  }

  players.sort(function(a, b) {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.diff - a.diff;
  });

  let byePlayer = null;
  if (players.length % 2 === 1) {
    const candidates = players.slice().sort(function(a, b) {
      if (a.wins !== b.wins) return a.wins - b.wins;
      return a.diff - b.diff;
    });
    byePlayer = candidates[0];
  }

  const remaining = players.filter(function(player) {
    return !byePlayer || player.name !== byePlayer.name;
  });

  const used = {};
  const pairs = [];

  for (let i = 0; i < remaining.length; i++) {
    const playerA = remaining[i];
    if (used[playerA.name]) continue;

    let opponent = null;

    for (let j = i + 1; j < remaining.length; j++) {
      const playerB = remaining[j];
      if (used[playerB.name]) continue;
      if (!history[playerA.name].includes(playerB.name)) {
        opponent = playerB;
        break;
      }
    }

    if (!opponent) {
      for (let j = i + 1; j < remaining.length; j++) {
        const playerB = remaining[j];
        if (!used[playerB.name]) {
          opponent = playerB;
          break;
        }
      }
    }

    if (opponent) {
      pairs.push([
        roundNumber, pairs.length + 1, playerA.name, opponent.name,
        0, 0, "", "未実施", "", "", ""
      ]);
      used[playerA.name] = true;
      used[opponent.name] = true;
    }
  }

  if (byePlayer) {
    pairs.push([
      roundNumber, pairs.length + 1, byePlayer.name, "BYE",
      4, 0, byePlayer.name, "確定", "", "", "不戦勝"
    ]);
  }

  if (pairs.length) {
    matchesSheet.getRange(
      matchesSheet.getLastRow() + 1, 1, pairs.length, 11
    ).setValues(pairs);
  }

  return pairs.length;
}

/* =========================
   対戦
========================= */

function getCurrentMatches() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tournament = ss.getSheetByName("大会");
  const sheet = ss.getSheetByName("対戦");

  const round = Number(tournament.getRange("B9").getValue()) || 0;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return { round: round, matches: [] };

  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const matches = [];

  data.forEach(function(row, index) {
    if (Number(row[0]) !== round) return;

    matches.push({
      row: index + 2,
      number: row[1],
      a: row[2],
      b: row[3],
      scoreA: Number(row[4]) || 0,
      scoreB: Number(row[5]) || 0,
      winner: row[6] || "",
      status: row[7] || "未実施",
      finishA: row[8] || "",
      finishB: row[9] || ""
    });
  });

  return { round: round, matches: matches };
}

function addBattlePoint(row, player, points, finishName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tournament = ss.getSheetByName("大会");
  const sheet = ss.getSheetByName("対戦");

  if (String(tournament.getRange("B8").getValue()) !== "開催中") {
    throw new Error("現在、大会は開催中ではありません。");
  }

  const status = String(sheet.getRange(row, 8).getValue() || "");
  if (status === "確定") throw new Error("この試合はすでに確定しています。");

  const scoreColumn = player === "A" ? 5 : 6;
  const finishColumn = player === "A" ? 9 : 10;

  const current = Number(sheet.getRange(row, scoreColumn).getValue()) || 0;
  const maxRecord = Number(tournament.getRange("B7").getValue()) || 6;
  const newScore = Math.min(current + Number(points), maxRecord);

  sheet.getRange(row, scoreColumn).setValue(newScore);
  sheet.getRange(row, finishColumn).setValue(String(finishName || ""));

  const scoreA = Number(sheet.getRange(row, 5).getValue()) || 0;
  const scoreB = Number(sheet.getRange(row, 6).getValue()) || 0;
  const winCondition = Number(tournament.getRange("B6").getValue()) || 4;

  let winner = "";
  if (scoreA >= winCondition && scoreB < winCondition) {
    winner = sheet.getRange(row, 3).getValue();
  } else if (scoreB >= winCondition && scoreA < winCondition) {
    winner = sheet.getRange(row, 4).getValue();
  }

  if (winner) {
    sheet.getRange(row, 7).setValue(winner);
    sheet.getRange(row, 8).setValue("確定");
    recalculateAllResults();
  }

  return {
    scoreA: scoreA,
    scoreB: scoreB,
    winner: winner
  };
}

/* =========================
   集計
========================= */

function recalculateAllResults() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playersSheet = ss.getSheetByName("選手");
  const matchesSheet = ss.getSheetByName("対戦");

  const playerData = playersSheet.getRange(2, 1, 30, 7).getValues();
  const stats = {};

  playerData.forEach(function(row) {
    const name = String(row[1] || "").trim();
    if (!name) return;
    stats[name] = { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
  });

  const lastRow = matchesSheet.getLastRow();
  if (lastRow >= 2) {
    const matches = matchesSheet.getRange(2, 1, lastRow - 1, 11).getValues();

    matches.forEach(function(row) {
      const a = row[2], b = row[3];
      const scoreA = Number(row[4]) || 0;
      const scoreB = Number(row[5]) || 0;
      const status = row[7];

      if (!a || !b || status !== "確定") return;

      if (b === "BYE") {
        if (stats[a]) stats[a].wins++;
        return;
      }

      if (!stats[a] || !stats[b]) return;

      stats[a].pointsFor += scoreA;
      stats[a].pointsAgainst += scoreB;
      stats[b].pointsFor += scoreB;
      stats[b].pointsAgainst += scoreA;

      if (scoreA >= 4 && scoreB < 4) {
        stats[a].wins++;
        stats[b].losses++;
      } else if (scoreB >= 4 && scoreA < 4) {
        stats[b].wins++;
        stats[a].losses++;
      }
    });
  }

  for (let i = 0; i < playerData.length; i++) {
    const name = String(playerData[i][1] || "").trim();
    if (!name || !stats[name]) continue;

    const s = stats[name];
    playersSheet.getRange(i + 2, 3, 1, 5).setValues([[
      s.wins, s.losses, s.pointsFor, s.pointsAgainst,
      s.pointsFor - s.pointsAgainst
    ]]);
  }

  updateRanking();
}

function updateRanking() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playersSheet = ss.getSheetByName("選手");
  const rankingSheet = ss.getSheetByName("順位");

  const data = playersSheet.getRange(2, 1, 30, 7).getValues()
    .filter(function(row) { return String(row[1]).trim() !== ""; });

  data.sort(function(a, b) {
    const winsA = Number(a[2]) || 0, winsB = Number(b[2]) || 0;
    const diffA = Number(a[6]) || 0, diffB = Number(b[6]) || 0;
    const pointsA = Number(a[4]) || 0, pointsB = Number(b[4]) || 0;

    if (winsB !== winsA) return winsB - winsA;
    if (diffB !== diffA) return diffB - diffA;
    return pointsB - pointsA;
  });

  rankingSheet.clear();
  rankingSheet.getRange(1, 1, 1, 8).setValues([[
    "順位", "選手名", "勝", "敗", "得点", "失点", "得失点差", "勝率"
  ]]);

  const output = data.map(function(row, index) {
    const wins = Number(row[2]) || 0;
    const losses = Number(row[3]) || 0;
    const total = wins + losses;

    return [
      index + 1, row[1], wins, losses,
      Number(row[4]) || 0, Number(row[5]) || 0,
      Number(row[6]) || 0, total ? wins / total : 0
    ];
  });

  if (output.length) {
    rankingSheet.getRange(2, 1, output.length, 8).setValues(output);
    rankingSheet.getRange(2, 8, output.length, 1).setNumberFormat("0.0%");
  }

  rankingSheet.autoResizeColumns(1, 8);
}

function getRankingData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("順位");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 8).getValues()
    .filter(function(row) { return row[1] !== ""; })
    .map(function(row) {
      return {
        rank: row[0],
        name: row[1],
        wins: row[2],
        losses: row[3],
        points: row[4],
        against: row[5],
        diff: row[6],
        winRate: row[7]
      };
    });
}

/* =========================
   次ラウンド
========================= */

function nextRound() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tournament = ss.getSheetByName("大会");
  const matches = ss.getSheetByName("対戦");

  if (String(tournament.getRange("B8").getValue()) !== "開催中") {
    throw new Error("現在、大会は開催中ではありません。");
  }

  const currentRound = Number(tournament.getRange("B9").getValue()) || 0;
  const totalRounds = Number(tournament.getRange("B5").getValue()) || 0;

  if (currentRound >= totalRounds) {
    throw new Error("設定した最終ラウンドです。大会を終了してください。");
  }

  const lastRow = matches.getLastRow();
  if (lastRow < 2) throw new Error("対戦カードがありません。");

  const allMatches = matches.getRange(2, 1, lastRow - 1, 11).getValues();
  const currentMatches = allMatches.filter(function(row) {
    return Number(row[0]) === currentRound;
  });

  if (currentMatches.some(function(row) { return row[7] !== "確定"; })) {
    throw new Error("まだ結果が確定していない試合があります。");
  }

  recalculateAllResults();

  const newRound = currentRound + 1;
  tournament.getRange("B9").setValue(newRound);
  createRound(newRound);

  return "ROUND " + newRound + "を開始しました！";
}

/* =========================
   大会終了
========================= */

function finishTournament() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tournament = ss.getSheetByName("大会");
  const matches = ss.getSheetByName("対戦");

  const status = String(tournament.getRange("B8").getValue() || "");
  if (status !== "開催中") throw new Error("開催中の大会ではありません。");

  const lastRow = matches.getLastRow();
  if (lastRow >= 2) {
    const data = matches.getRange(2, 1, lastRow - 1, 11).getValues();
    if (data.some(function(row) { return row[7] !== "確定"; })) {
      throw new Error("まだ結果が確定していない試合があります。");
    }
  }

  recalculateAllResults();
  tournament.getRange("B8").setValue("終了");

  const ranking = getRankingData();
  if (!ranking.length) throw new Error("順位データがありません。");

  return { champion: ranking[0], ranking: ranking };
}
