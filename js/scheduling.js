const SCHED_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCHED_ASSIGNEES = ['Both', 'Kasparas', 'Izolda'];
const SCHED_NTH_LABELS = ['1st', '2nd', '3rd', '4th'];

function addUnits(date, amount, unit) {
  const d = new Date(date);
  if (unit === 'days') d.setDate(d.getDate() + amount);
  else if (unit === 'weeks') d.setDate(d.getDate() + amount * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + amount);
  return d;
}

function nthWeekdayOfMonth(year, month, nth, weekday) {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const date = new Date(year, month, day);
  return date.getMonth() === month ? date : null;
}

// Smallest occurrence >= fromDate (and >= the schedule's anchor date). Bounded/exact —
// never linear-scans from the anchor, so an anchor from years ago stays cheap.
function nextOccurrenceAfter(schedule, fromDate) {
  const anchor = HD_CAL.parseYMD(schedule.anchorDate);
  anchor.setHours(0, 0, 0, 0);
  const start = fromDate > anchor ? new Date(fromDate) : new Date(anchor);
  start.setHours(0, 0, 0, 0);

  if (schedule.recurrenceKind === 'interval') {
    const unit = schedule.intervalUnit;
    const count = schedule.intervalCount;
    let k;
    if (unit === 'months') {
      const monthsDiff = (start.getFullYear() - anchor.getFullYear()) * 12 + (start.getMonth() - anchor.getMonth());
      k = Math.max(0, Math.ceil(monthsDiff / count));
    } else {
      const stepDays = count * (unit === 'weeks' ? 7 : 1);
      const diffDays = Math.round((start - anchor) / 86400000);
      k = Math.max(0, Math.ceil(diffDays / stepDays));
    }
    let d = addUnits(anchor, k * count, unit);
    for (let i = 0; i < 3 && d < start; i++) {
      k++;
      d = addUnits(anchor, k * count, unit);
    }
    return d;
  }

  let year = start.getFullYear();
  let month = start.getMonth();
  for (let i = 0; i < 60; i++) {
    const occ = nthWeekdayOfMonth(year, month, schedule.nth, schedule.weekday);
    if (occ && occ >= anchor && occ >= start) return occ;
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return null;
}

function occurrencesInRange(schedule, rangeStart, rangeEnd) {
  const results = [];
  let cursor = new Date(rangeStart);
  let guard = 0;
  while (guard++ < 200) {
    const next = nextOccurrenceAfter(schedule, cursor);
    if (!next || next > rangeEnd) break;
    results.push(new Date(next));
    cursor = HD_CAL.addDays(next, 1);
  }
  return results;
}

// Chores track completion, so their due date resets from lastDoneAt rather than
// the fixed calendar grid used for events.
function choreNextDue(schedule) {
  if (schedule.lastDoneAt) {
    return addUnits(new Date(schedule.lastDoneAt), schedule.intervalCount, schedule.intervalUnit);
  }
  return HD_CAL.parseYMD(schedule.anchorDate);
}

function describeRecurrence(schedule) {
  if (schedule.recurrenceKind === 'interval') {
    const unitLabel = schedule.intervalCount === 1 ? schedule.intervalUnit.slice(0, -1) : schedule.intervalUnit;
    return `Every ${schedule.intervalCount} ${unitLabel}`;
  }
  const nthLabel = SCHED_NTH_LABELS[schedule.nth - 1] || `${schedule.nth}th`;
  return `Every ${nthLabel} ${SCHED_WEEKDAY_LABELS[schedule.weekday]} of the month`;
}

// Merges all schedules into calendar-item shape for the given date range.
// Chores show only their single next-due occurrence; events expand to every
// occurrence in range.
async function getScheduleItemsInRange(rangeStart, rangeEnd) {
  const schedules = await HD_DB.dbGetAll('scheduling');
  const items = [];
  for (const s of schedules) {
    if (s.category === 'chore') {
      const due = choreNextDue(s);
      if (due >= rangeStart && due <= rangeEnd) {
        items.push({
          id: `sched-${s.id}-${HD_CAL.ymd(due)}`,
          title: s.title,
          date: HD_CAL.ymd(due),
          type: 'schedule',
          category: 'chore',
          assignedTo: s.assignedTo,
          notes: s.notes,
          isSchedule: true,
          scheduleId: s.id,
        });
      }
    } else {
      const occs = occurrencesInRange(s, rangeStart, rangeEnd);
      for (const occ of occs) {
        items.push({
          id: `sched-${s.id}-${HD_CAL.ymd(occ)}`,
          title: s.title,
          date: HD_CAL.ymd(occ),
          type: 'schedule',
          category: 'event',
          assignedTo: s.assignedTo,
          notes: s.notes,
          isSchedule: true,
          scheduleId: s.id,
        });
      }
    }
  }
  return items;
}

async function renderSchedulingTab(main) {
  main.innerHTML = `
    <div class="tab-header"><h2>Scheduling</h2><p class="text-muted">Recurring plans — chores, or things that repeat like "dinner every 3rd Friday". Chore progress is tracked in the Maintenance tab.</p></div>
    <form id="schedule-form" class="inline-form schedule-form">
      <input name="title" placeholder="Title" required>
      <select name="category">
        <option value="event">Event / plan</option>
        <option value="chore">Chore</option>
      </select>
      <select name="assignedTo">${SCHED_ASSIGNEES.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
      <select name="recurrenceKind" id="recurrenceKind">
        <option value="interval">Every N days/weeks/months</option>
        <option value="nthWeekday">Nth weekday of month</option>
      </select>
      <div id="interval-fields" class="recurrence-fields">
        <input type="number" name="intervalCount" min="1" value="1" style="width:70px">
        <select name="intervalUnit">
          <option value="days">Days</option>
          <option value="weeks">Weeks</option>
          <option value="months" selected>Months</option>
        </select>
      </div>
      <div id="nth-fields" class="recurrence-fields" hidden>
        <select name="nth">${SCHED_NTH_LABELS.map((l, i) => `<option value="${i + 1}">${l}</option>`).join('')}</select>
        <select name="weekday">${SCHED_WEEKDAY_LABELS.map((w, i) => `<option value="${i}">${w}</option>`).join('')}</select>
      </div>
      <label>Starting <input type="date" name="anchorDate" required></label>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button type="submit">Add schedule</button>
    </form>
    <div id="schedule-list"></div>`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  main.querySelector('[name=anchorDate]').value = HD_CAL.ymd(today);

  const kindSelect = document.getElementById('recurrenceKind');
  const intervalFields = document.getElementById('interval-fields');
  const nthFields = document.getElementById('nth-fields');
  kindSelect.addEventListener('change', () => {
    const isInterval = kindSelect.value === 'interval';
    intervalFields.hidden = !isInterval;
    nthFields.hidden = isInterval;
  });

  const listEl = document.getElementById('schedule-list');
  let editingId = null;

  function editFormHtml(s) {
    const isInterval = s.recurrenceKind === 'interval';
    return `
      <form class="item-edit-form" data-edit-form="${s.id}">
        <input name="title" value="${HD_CAL.escapeHtml(s.title)}" required>
        <select name="category">
          <option value="event" ${s.category === 'event' ? 'selected' : ''}>Event / plan</option>
          <option value="chore" ${s.category === 'chore' ? 'selected' : ''}>Chore</option>
        </select>
        <select name="assignedTo">${SCHED_ASSIGNEES.map((a) => `<option value="${a}" ${a === s.assignedTo ? 'selected' : ''}>${a}</option>`).join('')}</select>
        <select name="recurrenceKind" data-edit-kind="${s.id}">
          <option value="interval" ${isInterval ? 'selected' : ''}>Every N days/weeks/months</option>
          <option value="nthWeekday" ${!isInterval ? 'selected' : ''}>Nth weekday of month</option>
        </select>
        <div class="recurrence-fields" data-edit-interval-fields="${s.id}" ${isInterval ? '' : 'hidden'}>
          <input type="number" name="intervalCount" min="1" value="${s.intervalCount}" style="width:70px">
          <select name="intervalUnit">
            <option value="days" ${s.intervalUnit === 'days' ? 'selected' : ''}>Days</option>
            <option value="weeks" ${s.intervalUnit === 'weeks' ? 'selected' : ''}>Weeks</option>
            <option value="months" ${s.intervalUnit === 'months' ? 'selected' : ''}>Months</option>
          </select>
        </div>
        <div class="recurrence-fields" data-edit-nth-fields="${s.id}" ${isInterval ? 'hidden' : ''}>
          <select name="nth">${SCHED_NTH_LABELS.map((l, i) => `<option value="${i + 1}" ${s.nth === i + 1 ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select name="weekday">${SCHED_WEEKDAY_LABELS.map((w, i) => `<option value="${i}" ${s.weekday === i ? 'selected' : ''}>${w}</option>`).join('')}</select>
        </div>
        <label>Starting <input type="date" name="anchorDate" value="${s.anchorDate}" required></label>
        <textarea name="notes" placeholder="Notes (optional)">${HD_CAL.escapeHtml(s.notes || '')}</textarea>
        <div class="modal-form-actions">
          <button type="button" data-cancel-edit>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>`;
  }

  async function refresh() {
    const schedules = await HD_DB.dbGetAll('scheduling');
    schedules.sort((a, b) => a.title.localeCompare(b.title));

    listEl.innerHTML = schedules.length
      ? schedules.map((s) => {
        if (s.id === editingId) return editFormHtml(s);
        const next = s.category === 'chore' ? choreNextDue(s) : nextOccurrenceAfter(s, today);
        return `
        <div class="task-row" data-id="${s.id}">
          <div class="task-row-main">
            <span class="task-title">${HD_CAL.escapeHtml(s.title)}</span>
            <span class="badge">${s.category === 'chore' ? 'Chore' : 'Event'}</span>
            <span class="badge">${s.assignedTo || 'Both'}</span>
          </div>
          <div class="text-muted">${describeRecurrence(s)} — next: ${next ? HD_CAL.ymd(next) : '—'}${s.category === 'chore' ? ` (completed ${s.completedCount || 0}×, manage in Maintenance tab)` : ''}</div>
          ${s.notes ? `<div class="task-notes text-muted">${HD_CAL.escapeHtml(s.notes)}</div>` : ''}
          <div class="task-actions">
            <button type="button" data-edit="${s.id}">Edit</button>
            <button type="button" data-delete="${s.id}">Delete</button>
          </div>
        </div>`;
      }).join('')
      : '<p class="text-muted">No schedules yet.</p>';

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this schedule?')) return;
        await HD_DB.dbDelete('scheduling', btn.dataset.delete);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingId = btn.dataset.edit;
        refresh();
      });
    });

    listEl.querySelectorAll('[data-cancel-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingId = null;
        refresh();
      });
    });

    listEl.querySelectorAll('[data-edit-kind]').forEach((select) => {
      select.addEventListener('change', () => {
        const id = select.dataset.editKind;
        const isInterval = select.value === 'interval';
        listEl.querySelector(`[data-edit-interval-fields="${id}"]`).hidden = !isInterval;
        listEl.querySelector(`[data-edit-nth-fields="${id}"]`).hidden = isInterval;
      });
    });

    listEl.querySelectorAll('[data-edit-form]').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const id = form.dataset.editForm;
        const schedule = schedules.find((s) => s.id === id);
        const fd = new FormData(form);
        const title = fd.get('title').trim();
        if (!title) return;
        schedule.title = title;
        schedule.category = fd.get('category');
        schedule.assignedTo = fd.get('assignedTo');
        schedule.recurrenceKind = fd.get('recurrenceKind');
        schedule.intervalCount = Number(fd.get('intervalCount')) || 1;
        schedule.intervalUnit = fd.get('intervalUnit');
        schedule.nth = Number(fd.get('nth')) || 1;
        schedule.weekday = Number(fd.get('weekday')) || 0;
        schedule.anchorDate = fd.get('anchorDate');
        schedule.notes = fd.get('notes').trim();
        await HD_DB.dbPut('scheduling', schedule);
        editingId = null;
        refresh();
      });
    });
  }

  document.getElementById('schedule-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const title = fd.get('title').trim();
    if (!title) return;
    const recurrenceKind = fd.get('recurrenceKind');
    await HD_DB.dbPut('scheduling', {
      id: crypto.randomUUID(),
      title,
      category: fd.get('category'),
      assignedTo: fd.get('assignedTo'),
      recurrenceKind,
      intervalCount: Number(fd.get('intervalCount')) || 1,
      intervalUnit: fd.get('intervalUnit'),
      nth: Number(fd.get('nth')) || 1,
      weekday: Number(fd.get('weekday')) || 0,
      anchorDate: fd.get('anchorDate'),
      notes: fd.get('notes').trim(),
      lastDoneAt: null,
      completedCount: 0,
      createdAt: Date.now(),
    });
    ev.target.reset();
    main.querySelector('[name=anchorDate]').value = HD_CAL.ymd(today);
    intervalFields.hidden = false;
    nthFields.hidden = true;
    refresh();
  });

  refresh();
}

window.HD_SCHEDULING = {
  addUnits, nthWeekdayOfMonth, nextOccurrenceAfter, occurrencesInRange,
  choreNextDue, describeRecurrence, getScheduleItemsInRange, renderSchedulingTab,
  SCHED_WEEKDAY_LABELS, SCHED_ASSIGNEES,
};
