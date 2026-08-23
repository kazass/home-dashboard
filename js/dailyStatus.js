const DAILY_STATUS_RECHECK_MS = 5 * 60 * 1000;

function todayYmd() {
  return HD_CAL.ymd(new Date());
}

// Chores use their derived due date (no stored due-date field); homework
// tasks only show up here if they were given an optional due date. Either
// kind is excluded while postponedUntil is still in the future.
async function getDueToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = todayYmd();
  const items = [];

  const chores = (await HD_DB.dbGetAll('scheduling')).filter((s) => s.category === 'chore');
  for (const c of chores) {
    if (c.postponedUntil && c.postponedUntil > todayKey) continue;
    const due = HD_SCHEDULING.choreNextDue(c);
    if (due <= today) items.push({ kind: 'chore', id: c.id, title: c.title, assignedTo: c.assignedTo, overdue: due < today });
  }

  const tasks = (await HD_DB.dbGetAll('homeWork')).filter((t) => t.status !== 'done' && t.dueDate);
  for (const t of tasks) {
    if (t.postponedUntil && t.postponedUntil > todayKey) continue;
    if (t.dueDate <= todayKey) items.push({ kind: 'homework', id: t.id, title: t.title, assignedTo: t.assignedTo, overdue: t.dueDate < todayKey });
  }

  return items;
}

async function markChoreDone(id) {
  const chore = (await HD_DB.dbGetAll('scheduling')).find((s) => s.id === id);
  if (!chore) return;
  const due = HD_SCHEDULING.choreNextDue(chore);
  const doneAt = new Date();
  doneAt.setHours(0, 0, 0, 0);
  const onTime = !chore.lastDoneAt || doneAt <= due;
  const creditedTo = chore.assignedTo;
  chore.currentStreak = onTime ? (chore.currentStreak || 0) + 1 : 1;
  chore.lastDoneAt = doneAt.getTime();
  chore.completedCount = (chore.completedCount || 0) + 1;
  chore.postponedUntil = null;
  if (chore.rotate) {
    const names = HD_SETTINGS.getUserNames();
    const idx = names.indexOf(chore.assignedTo);
    if (idx >= 0) chore.assignedTo = names[(idx + 1) % names.length];
  }
  await HD_DB.dbPut('scheduling', chore);
  await HD_POINTS.logCompletion({
    itemType: 'chore', itemId: chore.id, person: creditedTo,
    points: (chore.points || 1) + HD_POINTS.streakBonus(chore.currentStreak),
  });
}

async function markHomeworkDone(id) {
  const task = (await HD_DB.dbGetAll('homeWork')).find((t) => t.id === id);
  if (!task) return;
  const completedDate = new Date();
  completedDate.setHours(0, 0, 0, 0);
  const onTime = !task.dueDate || task.dueDate >= HD_CAL.ymd(completedDate);
  task.status = 'done';
  task.completedAt = completedDate.getTime();
  task.currentStreak = onTime ? (task.currentStreak || 0) + 1 : 1;
  task.postponedUntil = null;
  await HD_DB.dbPut('homeWork', task);
  await HD_POINTS.logCompletion({
    itemType: 'homework', itemId: task.id, person: task.assignedTo,
    points: (task.points || 1) + HD_POINTS.streakBonus(task.currentStreak),
  });
}

async function postponeItem(item, days) {
  const until = HD_CAL.ymd(HD_CAL.addDays(new Date(), days));
  const store = item.kind === 'chore' ? 'scheduling' : 'homeWork';
  const record = (await HD_DB.dbGetAll(store)).find((r) => r.id === item.id);
  if (!record) return;
  record.postponedUntil = until;
  await HD_DB.dbPut(store, record);
}

function openDailyStatusModal() {
  let overlay = document.getElementById('daily-status-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'daily-status-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  async function render() {
    const items = await getDueToday();
    const leaderboard = await HD_POINTS.getLeaderboard();

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Today's status</h3>
          <button class="modal-close" id="daily-status-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="stats-bar-row-group">
            ${Object.entries(leaderboard).map(([name, points]) => `${HD_SETTINGS.personBadgeHtml(name)} <span class="text-muted">${points}pt${points === 1 ? '' : 's'}</span>`).join(' &nbsp; ')}
          </div>
          ${items.length ? items.map((item) => `
            <div class="task-row" data-item="${item.id}">
              <div class="task-row-main">
                <span class="task-title">${HD_CAL.escapeHtml(item.title)}</span>
                ${item.overdue ? '<span class="task-due overdue">Overdue</span>' : '<span class="task-due due-today">Due today</span>'}
                ${HD_SETTINGS.personBadgeHtml(item.assignedTo)}
              </div>
              <div class="task-actions">
                <button type="button" data-mark-done="${item.id}" data-kind="${item.kind}">Mark done</button>
                <button type="button" data-postpone="${item.id}" data-kind="${item.kind}" data-days="1">+1d</button>
                <button type="button" data-postpone="${item.id}" data-kind="${item.kind}" data-days="2">+2d</button>
                <button type="button" data-postpone="${item.id}" data-kind="${item.kind}" data-days="3">+3d</button>
              </div>
            </div>`).join('') : '<p class="text-muted">Nothing due today. 🎉</p>'}
        </div>
      </div>`;

    overlay.querySelector('#daily-status-close-btn').addEventListener('click', () => overlay.remove());

    overlay.querySelectorAll('[data-mark-done]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        if (btn.dataset.kind === 'chore') await markChoreDone(btn.dataset.markDone);
        else await markHomeworkDone(btn.dataset.markDone);
        render();
        refreshBadge();
      });
    });

    overlay.querySelectorAll('[data-postpone]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        await postponeItem({ kind: btn.dataset.kind, id: btn.dataset.postpone }, Number(btn.dataset.days));
        render();
        refreshBadge();
      });
    });
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  render();
}

// A quiet always-there badge beats an hourly popup interruption — same
// information (tap to see/act on it), no forced modal.
function renderBadge(count) {
  let badge = document.getElementById('daily-status-badge');
  if (!count) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('button');
    badge.id = 'daily-status-badge';
    badge.addEventListener('click', openDailyStatusModal);
    document.body.appendChild(badge);
  }
  badge.textContent = `⏰ ${count} due`;
}

async function refreshBadge() {
  if (!HD_SETTINGS.getDailyStatusEnabled()) {
    renderBadge(0);
    return;
  }
  const items = await getDueToday();
  renderBadge(items.length);
}

function initDailyStatusCheck() {
  refreshBadge();
  setInterval(refreshBadge, DAILY_STATUS_RECHECK_MS);
}

window.HD_DAILY_STATUS = { openDailyStatusModal, initDailyStatusCheck, getDueToday, refreshBadge };
