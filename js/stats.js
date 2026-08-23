async function buildStatsHtml() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const chores = (await HD_DB.dbGetAll('scheduling')).filter((s) => s.category === 'chore');
  const homeWork = await HD_DB.dbGetAll('homeWork');
  const ideas = await HD_DB.dbGetAll('ideas');

  // Per-person chore completions. Rotating chores only have one current
  // "assignedTo", so their whole count attributes to whoever holds it now —
  // a simplification, not a true per-turn split.
  const byPerson = { Kasparas: 0, Izolda: 0 };
  for (const c of chores) {
    if (byPerson[c.assignedTo] !== undefined) byPerson[c.assignedTo] += c.completedCount || 0;
  }
  const maxCount = Math.max(1, ...Object.values(byPerson));

  const tasksDoneThisMonth = homeWork.filter((t) => t.status === 'done' && t.completedAt >= monthStart).length;
  const ideasDoneThisMonth = ideas.filter((i) => i.status === 'done' && i.completedAt >= monthStart).length;

  const topChores = [...chores].sort((a, b) => (b.completedCount || 0) - (a.completedCount || 0)).slice(0, 5);

  return `
    <h4>Chores by person</h4>
    ${Object.entries(byPerson).map(([name, count]) => `
      <div class="stats-bar-row">
        ${HD_SETTINGS.personBadgeHtml(name)}
        <div class="stats-bar"><div class="stats-bar-fill" style="width:${(count / maxCount) * 100}%; background:${HD_SETTINGS.getPersonColor(name) || 'var(--accent)'}"></div></div>
        <span class="text-muted">${count}</span>
      </div>`).join('')}

    <h4>This month</h4>
    <p class="text-muted">${tasksDoneThisMonth} task${tasksDoneThisMonth === 1 ? '' : 's'} done, ${ideasDoneThisMonth} idea${ideasDoneThisMonth === 1 ? '' : 's'} checked off.</p>

    <h4>Chore streaks</h4>
    ${topChores.length ? topChores.map((c) => `
      <div class="stats-streak-row">
        <span class="task-title">${HD_CAL.escapeHtml(c.title)}</span>
        ${HD_MAINTENANCE.streakHtml(c.completedCount || 0)}
      </div>`).join('') : '<p class="text-muted">No chores tracked yet.</p>'}`;
}

function openStatsPanel() {
  let panel = document.getElementById('stats-panel');
  if (panel) { panel.classList.add('open'); refreshStats(); return; }

  panel = document.createElement('div');
  panel.id = 'stats-panel';
  panel.innerHTML = `
    <div class="stats-panel-header">
      <h3>📊 Stats</h3>
      <button type="button" id="stats-close-btn" aria-label="Close">&times;</button>
    </div>
    <div class="stats-panel-body" id="stats-panel-body"><p class="text-muted">Loading…</p></div>`;
  document.body.appendChild(panel);
  panel.querySelector('#stats-close-btn').addEventListener('click', closeStatsPanel);

  void panel.offsetWidth; // force a layout flush so the slide-in transition actually plays
  panel.classList.add('open');
  refreshStats();
}

async function refreshStats() {
  const body = document.getElementById('stats-panel-body');
  if (body) body.innerHTML = await buildStatsHtml();
}

function closeStatsPanel() {
  const panel = document.getElementById('stats-panel');
  if (panel) panel.classList.remove('open');
}

function isStatsPanelOpen() {
  const panel = document.getElementById('stats-panel');
  return !!(panel && panel.classList.contains('open'));
}

// Edge-swipe: start a drag within ~24px of the right edge, drag left past a
// threshold to open; while open, drag right past a threshold to close.
// Pointer Events cover both touch and mouse.
function initStatsSwipe() {
  const EDGE_ZONE = 24;
  const THRESHOLD = 60;
  let startX = null;

  document.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.buttons !== 1) return;
    const nearRightEdge = window.innerWidth - ev.clientX < EDGE_ZONE;
    if (nearRightEdge || isStatsPanelOpen()) startX = ev.clientX;
  }, { passive: true });

  document.addEventListener('pointermove', (ev) => {
    if (startX === null) return;
    const delta = startX - ev.clientX;
    if (!isStatsPanelOpen() && delta > THRESHOLD) {
      openStatsPanel();
      startX = null;
    } else if (isStatsPanelOpen() && -delta > THRESHOLD) {
      closeStatsPanel();
      startX = null;
    }
  }, { passive: true });

  document.addEventListener('pointerup', () => { startX = null; }, { passive: true });

  // Persistent tab handle for discoverability / non-touch reliability.
  const tab = document.createElement('button');
  tab.id = 'stats-edge-tab';
  tab.textContent = '📊';
  tab.title = 'Stats';
  tab.addEventListener('click', openStatsPanel);
  document.body.appendChild(tab);
}

window.HD_STATS = { openStatsPanel, closeStatsPanel, initStatsSwipe };
