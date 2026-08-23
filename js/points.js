// Every point-earning completion (chore/homework, plus zero-point activity
// logs) writes one row here — a single shared log instead of separate ad hoc
// counters, so the leaderboard, streak displays, and activity stats can all
// derive from the same source.
function streakBonus(streak) {
  return streak > 0 && streak % 3 === 0 ? 1 : 0; // +1 every 3rd on-time completion in a row
}

async function logCompletion({ itemType, itemId, person, points, date }) {
  if (!HD_SETTINGS.getUserNames().includes(person)) return; // skip 'Both'/unassigned
  await HD_DB.dbPut('completions', {
    id: crypto.randomUUID(),
    itemType,
    itemId,
    person,
    points,
    date: date || HD_CAL.ymd(new Date()),
    createdAt: Date.now(),
  });
}

async function getLeaderboard({ sinceTs } = {}) {
  const rows = (await HD_DB.dbGetAll('completions')).filter((c) => !sinceTs || c.createdAt >= sinceTs);
  const totals = {};
  for (const name of HD_SETTINGS.getUserNames()) totals[name] = 0;
  for (const r of rows) {
    if (totals[r.person] !== undefined) totals[r.person] += r.points;
  }
  return totals;
}

window.HD_POINTS = { streakBonus, logCompletion, getLeaderboard };
