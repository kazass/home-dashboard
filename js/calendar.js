const EVENT_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
  { value: 'trip', label: 'Trip' },
];

const ASSIGNEES = ['Both', 'Kasparas', 'Izolda'];

const CAL_STATE = {
  mode: 'month', // 'month' | 'week'
  refDate: new Date(),
};

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthMatrix(year, month) {
  const lastOfMonth = new Date(year, month + 1, 0);
  const weeks = [];
  let cur = startOfWeek(new Date(year, month, 1));
  while (true) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    weeks.push(week);
    if (cur > lastOfMonth) break;
  }
  return weeks;
}

// Completed tasks/ideas/chores show up as a read-only checkmark chip on the
// day they were finished, so the calendar also reads as a light activity log.
async function getCompletedItemsInRange(rangeStart, rangeEnd) {
  const items = [];
  const inRange = (d) => d >= rangeStart && d <= rangeEnd;

  const homeWork = await HD_DB.dbGetAll('homeWork');
  for (const t of homeWork) {
    if (t.status === 'done' && t.completedAt) {
      const d = new Date(t.completedAt);
      if (inRange(d)) {
        items.push({
          id: `done-hw-${t.id}`, title: `✓ ${t.title}`, date: ymd(d),
          type: 'completed', isCompletedRecord: true, sourceTab: 'Tasks',
        });
      }
    }
  }

  const ideas = await HD_DB.dbGetAll('ideas');
  for (const i of ideas) {
    if (i.status === 'done' && i.completedAt) {
      const d = new Date(i.completedAt);
      if (inRange(d)) {
        items.push({
          id: `done-idea-${i.id}`, title: `✓ ${i.title}`, date: ymd(d),
          type: 'completed', isCompletedRecord: true, sourceTab: 'Ideas',
        });
      }
    }
  }

  const schedules = await HD_DB.dbGetAll('scheduling');
  for (const c of schedules) {
    if (c.category === 'chore' && c.lastDoneAt) {
      const d = new Date(c.lastDoneAt);
      if (inRange(d)) {
        items.push({
          id: `done-chore-${c.id}-${ymd(d)}`, title: `✓ ${c.title}`, date: ymd(d),
          type: 'completed', isCompletedRecord: true, sourceTab: 'Tasks',
        });
      }
    }
  }

  return items;
}

async function loadEventsAndHolidays(years, rangeStart, rangeEnd) {
  const events = await HD_DB.dbGetAll('events');
  const holidayLists = await Promise.all(
    [...years].map((y) => HD_HOLIDAYS.getHolidays(y).catch(() => []))
  );
  const holidays = holidayLists.flat().map((h) => ({
    id: 'holiday-' + h.date,
    title: h.name,
    date: h.date,
    type: 'holiday',
    isHoliday: true,
  }));
  const scheduleItems = (rangeStart && rangeEnd && window.HD_SCHEDULING)
    ? await HD_SCHEDULING.getScheduleItemsInRange(rangeStart, rangeEnd).catch(() => [])
    : [];
  const plantItems = (rangeStart && rangeEnd && window.HD_GARDEN)
    ? await HD_GARDEN.getPlantWaterItemsInRange(rangeStart, rangeEnd).catch(() => [])
    : [];
  const showCompleted = window.HD_SETTINGS ? HD_SETTINGS.getShowCompletedOnCalendar() : false;
  const completedItems = (rangeStart && rangeEnd && showCompleted)
    ? await getCompletedItemsInRange(rangeStart, rangeEnd).catch(() => [])
    : [];
  return [...events, ...holidays, ...scheduleItems, ...plantItems, ...completedItems];
}

function groupByDate(items) {
  const map = new Map();
  for (const item of items) {
    const start = parseYMD(item.date);
    const end = item.endDate ? parseYMD(item.endDate) : start;
    let cur = start;
    while (cur <= end) {
      const key = ymd(cur);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
      cur = addDays(cur, 1);
    }
  }
  return map;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Chip color is collapsed to a few meaningful groups (event / recurring /
// holiday / completed) rather than one hue per sub-type, to keep a busy
// month view readable; the sub-type is still conveyed via a small icon.
function chipClass(item) {
  if (item.isHoliday) return 'holiday';
  if (item.type === 'schedule' || item.type === 'plant') return 'recurring';
  if (item.type === 'completed') return 'completed';
  return 'event';
}

function chipIcon(item) {
  if (item.type === 'work') return '💼 ';
  if (item.type === 'trip') return '✈️ ';
  if (item.type === 'plant') return '💧 ';
  if (item.type === 'schedule') return item.category === 'chore' ? '🧹 ' : '🔁 ';
  return '';
}

function eventChipHtml(item) {
  return `<div class="event-chip ${chipClass(item)}">${chipIcon(item)}${escapeHtml(item.title)}</div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function renderCalendar(container, onDayClick) {
  const today = new Date();
  const todayKey = ymd(today);
  let years;
  let rangeItems;

  if (CAL_STATE.mode === 'month') {
    const year = CAL_STATE.refDate.getFullYear();
    const month = CAL_STATE.refDate.getMonth();
    const weeks = monthMatrix(year, month);
    years = new Set(weeks.flat().map((d) => d.getFullYear()));
    const items = await loadEventsAndHolidays(years, weeks[0][0], weeks[weeks.length - 1][6]);
    const byDate = groupByDate(items);

    const header = `
      <div class="cal-toolbar">
        <div class="cal-toolbar-nav">
          <button class="cal-nav-btn" data-nav="prev">&lt;</button>
          <h3>${MONTH_LABELS[month]} ${year}</h3>
          <button class="cal-nav-btn" data-nav="next">&gt;</button>
        </div>
        <div class="cal-toolbar-modes">
          <button class="cal-mode-btn active" data-mode="month">Month</button>
          <button class="cal-mode-btn" data-mode="week">Week</button>
          <button class="cal-nav-btn" data-nav="today">Today</button>
        </div>
      </div>`;

    const weekdayRow = `<div class="cal-grid cal-weekdays">${WEEKDAY_LABELS.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}</div>`;

    const rows = weeks.map((week) => {
      const cells = week.map((day) => {
        const key = ymd(day);
        const inMonth = day.getMonth() === month;
        const dayItems = byDate.get(key) || [];
        const isToday = key === todayKey;
        return `
          <div class="cal-cell ${inMonth ? '' : 'outside'} ${isToday ? 'today' : ''}" data-date="${key}">
            <div class="cal-cell-daynum">${day.getDate()}</div>
            <div class="cal-cell-events">${dayItems.slice(0, 3).map(eventChipHtml).join('')}${dayItems.length > 3 ? `<div class="event-chip more">+${dayItems.length - 3} more</div>` : ''}</div>
          </div>`;
      }).join('');
      return `<div class="cal-grid cal-week-row">${cells}</div>`;
    }).join('');

    container.innerHTML = header + weekdayRow + rows;
  } else {
    const weekStart = startOfWeek(CAL_STATE.refDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    years = new Set(days.map((d) => d.getFullYear()));
    const items = await loadEventsAndHolidays(years, days[0], days[6]);
    const byDate = groupByDate(items);
    const weekEnd = addDays(weekStart, 6);
    const rangeLabel = `${MONTH_LABELS[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekEnd.getMonth() !== weekStart.getMonth() ? MONTH_LABELS[weekEnd.getMonth()] + ' ' : ''}${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;

    const header = `
      <div class="cal-toolbar">
        <div class="cal-toolbar-nav">
          <button class="cal-nav-btn" data-nav="prev">&lt;</button>
          <h3>${rangeLabel}</h3>
          <button class="cal-nav-btn" data-nav="next">&gt;</button>
        </div>
        <div class="cal-toolbar-modes">
          <button class="cal-mode-btn" data-mode="month">Month</button>
          <button class="cal-mode-btn active" data-mode="week">Week</button>
          <button class="cal-nav-btn" data-nav="today">Today</button>
        </div>
      </div>`;

    const cols = days.map((day) => {
      const key = ymd(day);
      const dayItems = byDate.get(key) || [];
      const isToday = key === todayKey;
      return `
        <div class="cal-week-col ${isToday ? 'today' : ''}" data-date="${key}">
          <div class="cal-week-col-header">${WEEKDAY_LABELS[(day.getDay() + 6) % 7]} ${day.getDate()}</div>
          <div class="cal-week-col-events">${dayItems.map(eventChipHtml).join('') || '<div class="cal-week-empty">—</div>'}</div>
        </div>`;
    }).join('');

    container.innerHTML = header + `<div class="cal-week-grid">${cols}</div>`;
  }

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'today') {
        CAL_STATE.refDate = new Date();
      } else {
        const delta = nav === 'next' ? 1 : -1;
        if (CAL_STATE.mode === 'month') {
          CAL_STATE.refDate = new Date(CAL_STATE.refDate.getFullYear(), CAL_STATE.refDate.getMonth() + delta, 1);
        } else {
          CAL_STATE.refDate = addDays(CAL_STATE.refDate, delta * 7);
        }
      }
      renderCalendar(container, onDayClick);
    });
  });

  container.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      CAL_STATE.mode = btn.dataset.mode;
      renderCalendar(container, onDayClick);
    });
  });

  container.querySelectorAll('[data-date]').forEach((cell) => {
    cell.addEventListener('click', () => onDayClick(cell.dataset.date));
  });
}

function googleCalendarLink(item) {
  const start = item.date.replace(/-/g, '');
  const endExclusive = addDays(parseYMD(item.endDate || item.date), 1);
  const end = ymd(endExclusive).replace(/-/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${start}/${end}`,
    details: item.notes || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

window.HD_CAL = {
  ymd, parseYMD, addDays, startOfWeek, monthMatrix, loadEventsAndHolidays,
  getCompletedItemsInRange, groupByDate, renderCalendar, googleCalendarLink, escapeHtml,
  chipClass, chipIcon, EVENT_TYPES, ASSIGNEES, CAL_STATE,
};
