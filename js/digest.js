// Returns the one-line "This week: X, Y, Z." summary sentence as plain text
// (caller decides how/where to render it) so the Agenda card can fold it in
// instead of keeping a separate Digest card with near-identical source data.
async function getWeeklySummaryText() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = HD_CAL.startOfWeek(today);
  const weekEnd = HD_CAL.addDays(weekStart, 6);

  const homeWork = (await HD_DB.dbGetAll('homeWork')).filter((t) => t.status !== 'done');
  const chores = (await HD_DB.dbGetAll('scheduling')).filter((s) => s.category === 'chore');
  const events = await HD_DB.dbGetAll('events');

  const inRange = (item) => {
    const s = HD_CAL.parseYMD(item.date);
    const e = item.endDate ? HD_CAL.parseYMD(item.endDate) : s;
    return s <= weekEnd && e >= weekStart;
  };

  const choresDue = chores.filter((c) => {
    const due = HD_SCHEDULING.choreNextDue(c);
    return due >= weekStart && due <= weekEnd;
  });
  const trips = events.filter((e) => e.type === 'trip' && inRange(e));
  const rotating = choresDue.find((c) => c.rotate);

  const parts = [`${choresDue.length} chore${choresDue.length === 1 ? '' : 's'} due`];
  if (trips.length) parts.push(`${trips.length} trip${trips.length === 1 ? '' : 's'}`);
  if (homeWork.length) parts.push(`${homeWork.length} open task${homeWork.length === 1 ? '' : 's'}`);
  if (rotating) parts.push(`${HD_CAL.escapeHtml(rotating.assignedTo)}'s turn for ${HD_CAL.escapeHtml(rotating.title.toLowerCase())}`);

  return `${parts.join(', ')}.`;
}

window.HD_DIGEST = { getWeeklySummaryText };
