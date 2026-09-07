// Every point-earning completion (chore/homework, plus zero-point activity
// logs) writes one row here — a single shared log instead of separate ad hoc
// counters, so the leaderboard, streak displays, and activity stats can all
// derive from the same source.
function streakBonus(streak) {
  return streak > 0 && streak % 3 === 0 ? 1 : 0; // +1 every 3rd on-time completion in a row
}

function completionId(itemType, itemId, date = HD_CAL.ymd(new Date())) {
  if (itemType === 'homework') return `homework:${itemId}`;
  if (itemType === 'chore') return `chore:${itemId}:${date}`;
  return null;
}

async function logCompletion({ id, itemType, itemId, person, points, date }) {
  if (!HD_SETTINGS.getUserNames().includes(person)) return; // skip 'Both'/unassigned
  const completionDate = date || HD_CAL.ymd(new Date());
  const record = {
    id: id || completionId(itemType, itemId, completionDate) || crypto.randomUUID(),
    itemType,
    itemId,
    person,
    points,
    date: completionDate,
    createdAt: Date.now(),
  };
  await HD_DB.dbPut('completions', record);
  return record;
}

async function hasCompletion(itemType, itemId, date) {
  const id = completionId(itemType, itemId, date);
  if (!id) return false;
  if (await HD_DB.dbGet('completions', id)) return true;
  // Compatibility with completion rows created before stable IDs were added.
  const rows = await HD_DB.dbGetAll('completions');
  return rows.some((row) => row.itemType === itemType && row.itemId === itemId && row.date === date);
}

async function deleteCompletionsForItem(itemType, itemId) {
  const rows = await HD_DB.dbGetAll('completions');
  const matches = rows.filter((r) => r.itemType === itemType && r.itemId === itemId);
  for (const row of matches) await HD_DB.dbDelete('completions', row.id);
}

async function getLeaderboard({ sinceTs } = {}) {
  const rows = (await HD_DB.dbGetAll('completions'))
    .filter((c) => !sinceTs || c.createdAt >= sinceTs)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const totals = {};
  const seenSingleCompletions = new Set();
  for (const name of HD_SETTINGS.getUserNames()) totals[name] = 0;
  for (const r of rows) {
    // Older app versions used random IDs, so historical double-clicks or
    // complete/undo/recomplete cycles may already exist. One-off homework is
    // counted once; a recurring chore is counted at most once per day.
    const uniqueKey = r.itemType === 'homework'
      ? `homework:${r.itemId}`
      : r.itemType === 'chore' ? `chore:${r.itemId}:${r.date}` : null;
    if (uniqueKey && seenSingleCompletions.has(uniqueKey)) continue;
    if (uniqueKey) seenSingleCompletions.add(uniqueKey);
    if (totals[r.person] !== undefined) totals[r.person] += r.points;
  }
  return totals;
}

window.HD_POINTS = {
  streakBonus, completionId, logCompletion, hasCompletion,
  deleteCompletionsForItem, getLeaderboard,
};
