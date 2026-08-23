function openEventModal(dateStr, onChange) {
  let overlay = document.getElementById('event-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'event-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  let editingId = null;

  function close() {
    overlay.remove();
  }

  async function refresh() {
    const all = await HD_DB.dbGetAll('events');
    const dayOnly = HD_CAL.parseYMD(dateStr);
    const scheduleItems = window.HD_SCHEDULING
      ? await HD_SCHEDULING.getScheduleItemsInRange(dayOnly, dayOnly).catch(() => [])
      : [];
    const plantItems = window.HD_GARDEN
      ? await HD_GARDEN.getPlantWaterItemsInRange(dayOnly, dayOnly).catch(() => [])
      : [];
    const completedItems = await HD_CAL.getCompletedItemsInRange(dayOnly, dayOnly).catch(() => []);
    const dayEvents = [
      ...all.filter((e) => e.date <= dateStr && (e.endDate || e.date) >= dateStr),
      ...scheduleItems,
      ...plantItems,
      ...completedItems,
    ];
    const label = HD_CAL.parseYMD(dateStr).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const editing = editingId ? dayEvents.find((e) => e.id === editingId) : null;

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${label}</h3>
          <button class="modal-close" id="modal-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="event-list">
            ${dayEvents.length === 0 ? '<p class="text-muted">No events yet.</p>' : dayEvents.map((e) => `
              <div class="event-row">
                <div class="event-row-main">
                  <span class="event-dot ${HD_CAL.chipClass(e)}"></span>
                  <span>${HD_CAL.chipIcon(e)}${HD_CAL.escapeHtml(e.title)}</span>
                  ${e.isHoliday ? '<span class="badge">Holiday</span>' : e.isCompletedRecord ? '<span class="badge">Completed</span>' : e.isSchedule ? `<span class="badge">${{ chore: 'Chore', plant: 'Watering' }[e.category] || 'Recurring'}</span>` : HD_SETTINGS.personBadgeHtml(e.assignedTo)}
                </div>
                ${e.isHoliday || e.isSchedule || e.isCompletedRecord ? (e.isSchedule ? `<div class="text-muted">Manage in the ${e.category === 'plant' ? 'Garden' : 'Tasks'} tab.</div>` : e.isCompletedRecord ? `<div class="text-muted">See the ${e.sourceTab} tab.</div>` : '') : `
                  <div class="event-row-actions">
                    <a href="${HD_CAL.googleCalendarLink(e)}" target="_blank" rel="noopener">Add to Google Cal</a>
                    <button type="button" data-edit="${e.id}">Edit</button>
                    <button type="button" data-delete="${e.id}">Delete</button>
                  </div>`}
              </div>`).join('')}
          </div>
          <form id="event-form" class="event-form">
            <h4>${editing ? 'Edit event' : 'Add event'}</h4>
            <label>Title
              <input name="title" required value="${editing ? HD_CAL.escapeHtml(editing.title) : ''}">
            </label>
            <label>End date (optional, for multi-day)
              <input type="date" name="endDate" value="${editing && editing.endDate ? editing.endDate : ''}">
            </label>
            <label>Type
              <select name="type">
                ${HD_CAL.EVENT_TYPES.map((t) => `<option value="${t.value}" ${editing && editing.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </label>
            <label>Assigned to
              <select name="assignedTo">
                ${HD_CAL.ASSIGNEES.map((a) => `<option value="${a}" ${editing && editing.assignedTo === a ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </label>
            <label>Notes
              <textarea name="notes">${editing ? HD_CAL.escapeHtml(editing.notes || '') : ''}</textarea>
            </label>
            <div class="modal-form-actions">
              ${editing ? '<button type="button" id="cancel-edit-btn">Cancel edit</button>' : ''}
              <button type="submit">${editing ? 'Save changes' : 'Add event'}</button>
            </div>
          </form>
        </div>
      </div>`;

    overlay.querySelector('#modal-close-btn').addEventListener('click', close);

    overlay.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingId = btn.dataset.edit;
        refresh();
      });
    });

    overlay.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this event?')) return;
        await HD_DB.dbDelete('events', btn.dataset.delete);
        editingId = null;
        await refresh();
        onChange();
      });
    });

    const cancelBtn = overlay.querySelector('#cancel-edit-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { editingId = null; refresh(); });

    overlay.querySelector('#event-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const title = fd.get('title').trim();
      if (!title) return;
      const record = {
        id: editing ? editing.id : crypto.randomUUID(),
        title,
        date: dateStr,
        endDate: fd.get('endDate') || null,
        type: fd.get('type'),
        assignedTo: fd.get('assignedTo'),
        notes: fd.get('notes').trim(),
      };
      await HD_DB.dbPut('events', record);
      onChange();
      close();
    });
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  refresh();
}

async function renderWeatherWidget(container) {
  container.innerHTML = '<p class="text-muted">Loading weather…</p>';
  try {
    const loc = await HD_WEATHER.getLocation();
    const data = await HD_WEATHER.fetchWeather(loc.lat, loc.lon);
    const cur = data.current;
    const daily = data.daily;
    const forecastHtml = daily.time.slice(0, 7).map((date, i) => {
      const d = HD_CAL.parseYMD(date);
      const label = i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
      return `<div class="forecast-day">
        <div class="forecast-day-label">${label}</div>
        <div class="forecast-day-temp">${Math.round(daily.temperature_2m_max[i])}°/${Math.round(daily.temperature_2m_min[i])}°</div>
      </div>`;
    }).join('');
    container.innerHTML = `
      <div class="weather-now">
        <span class="weather-now-temp">${Math.round(cur.temperature_2m)}°C</span>
        <span class="weather-now-desc">${HD_WEATHER.weatherCodeText(cur.weather_code)}</span>
      </div>
      <div class="forecast-row">${forecastHtml}</div>`;
  } catch (err) {
    container.innerHTML = `<p class="text-muted">Weather unavailable (${HD_CAL.escapeHtml(err.message || String(err))}). Grant location access on the tablet to enable it.</p>`;
  }
}

async function renderAgenda(container) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = HD_CAL.startOfWeek(today);
  const weekEnd = HD_CAL.addDays(weekStart, 6);
  const rawEvents = await HD_DB.dbGetAll('events');
  const scheduleItems = window.HD_SCHEDULING
    ? await HD_SCHEDULING.getScheduleItemsInRange(weekStart, weekEnd).catch(() => [])
    : [];
  const plantItems = window.HD_GARDEN
    ? await HD_GARDEN.getPlantWaterItemsInRange(weekStart, weekEnd).catch(() => [])
    : [];
  const events = [...rawEvents, ...scheduleItems, ...plantItems];
  const years = new Set([today.getFullYear(), today.getFullYear() + 1]);
  const holidayLists = await Promise.all([...years].map((y) => HD_HOLIDAYS.getHolidays(y).catch(() => [])));
  const holidays = holidayLists.flat();

  const inRange = (item, start, end) => {
    const s = HD_CAL.parseYMD(item.date);
    const e = item.endDate ? HD_CAL.parseYMD(item.endDate) : s;
    return s <= end && e >= start;
  };

  const dueToday = events.filter((e) => inRange(e, today, today));
  const dueThisWeek = events.filter((e) => inRange(e, weekStart, weekEnd) && !dueToday.includes(e));
  const upcomingHolidays = holidays
    .filter((h) => HD_CAL.parseYMD(h.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const upcomingTrips = events
    .filter((e) => e.type === 'trip' && HD_CAL.parseYMD(e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const listOrEmpty = (items, render, emptyText) =>
    items.length ? `<ul class="agenda-list">${items.map(render).join('')}</ul>` : `<p class="text-muted">${emptyText}</p>`;

  container.innerHTML = `
    <h4>Agenda</h4>
    <div class="agenda-section">
      <h5>Due today</h5>
      ${listOrEmpty(dueToday, (e) => `<li>${HD_CAL.escapeHtml(e.title)} ${HD_SETTINGS.personBadgeHtml(e.assignedTo)}</li>`, 'Nothing due today.')}
    </div>
    <div class="agenda-section">
      <h5>This week</h5>
      ${listOrEmpty(dueThisWeek, (e) => `<li>${HD_CAL.escapeHtml(e.title)} ${HD_SETTINGS.personBadgeHtml(e.assignedTo)}</li>`, 'Nothing else this week.')}
    </div>
    <div class="agenda-section">
      <h5>Upcoming holidays</h5>
      ${listOrEmpty(upcomingHolidays, (h) => `<li>${HD_CAL.escapeHtml(h.name)} — ${h.date}</li>`, 'None coming up.')}
    </div>
    <div class="agenda-section">
      <h5>Upcoming trips</h5>
      ${listOrEmpty(upcomingTrips, (e) => `<li>${HD_CAL.escapeHtml(e.title)} — ${e.date}</li>`, 'No trips planned.')}
    </div>`;
}

async function renderMiniNotesAndShopping(container) {
  const notes = await HD_DB.dbGetAll('notes');
  const sortedNotes = notes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
  const items = await HD_DB.dbGetAll('shoppingItems');
  const unchecked = items.filter((i) => !i.checked).slice(0, 5);

  container.innerHTML = `
    <h4><a href="#notes" class="mini-link">Notes</a></h4>
    ${sortedNotes.length
      ? `<ul class="mini-list">${sortedNotes.map((n) => `<li>${HD_CAL.escapeHtml(n.text.slice(0, 80))}</li>`).join('')}</ul>`
      : '<p class="text-muted">No notes yet.</p>'}
    <hr class="mini-divider">
    <h4><a href="#shopping" class="mini-link">Shopping list</a></h4>
    ${unchecked.length
      ? `<ul class="mini-list">${unchecked.map((i) => `<li>${HD_CAL.escapeHtml(i.item)}</li>`).join('')}</ul>`
      : '<p class="text-muted">Shopping list is empty.</p>'}`;
}

let tripCountdownIntervalId = null;

async function renderTripCountdown(container) {
  if (tripCountdownIntervalId) {
    clearInterval(tripCountdownIntervalId);
    tripCountdownIntervalId = null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = await HD_DB.dbGetAll('events');
  const upcoming = events
    .filter((e) => e.type === 'trip' && HD_CAL.parseYMD(e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!upcoming) {
    container.innerHTML = '<p class="text-muted">🧳 No upcoming trips planned.</p>';
    return;
  }

  const target = HD_CAL.parseYMD(upcoming.date);
  const unit = (n, label) => `<div class="tc-unit"><span class="tc-num">${n}</span><span class="tc-label">${label}</span></div>`;

  function tick() {
    if (!container.isConnected) {
      clearInterval(tripCountdownIntervalId);
      tripCountdownIntervalId = null;
      return;
    }
    const diff = target - new Date();
    if (diff <= 0) {
      container.innerHTML = `<div class="trip-countdown"><span class="trip-countdown-title">🧳 ${HD_CAL.escapeHtml(upcoming.title)}</span><span class="trip-countdown-label">Today!</span></div>`;
      clearInterval(tripCountdownIntervalId);
      tripCountdownIntervalId = null;
      return;
    }
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    container.innerHTML = `
      <div class="trip-countdown">
        <span class="trip-countdown-title">🧳 ${HD_CAL.escapeHtml(upcoming.title)}</span>
        <div class="trip-countdown-clock">
          ${unit(days, 'd')}${unit(String(hours).padStart(2, '0'), 'h')}${unit(String(minutes).padStart(2, '0'), 'm')}${unit(String(seconds).padStart(2, '0'), 's')}
        </div>
      </div>`;
  }

  tick();
  tripCountdownIntervalId = setInterval(tick, 1000);
}

const SIDEBAR_CARD_DEFS = {
  decide: {
    html: '<button type="button" id="decide-btn" class="decide-launch-btn">🎲 Help me decide</button>',
    className: 'decide-card',
    init: () => document.getElementById('decide-btn').addEventListener('click', () => {
      if (window.HD_DECIDE) HD_DECIDE.openDecideModal();
    }),
  },
  trip: { html: '', init: (el) => renderTripCountdown(el) },
  weather: {
    html: '<h4>Weather</h4><div id="dash-weather-body"></div>',
    init: () => renderWeatherWidget(document.getElementById('dash-weather-body')),
  },
  digest: { html: '', init: (el) => window.HD_DIGEST && HD_DIGEST.renderWeeklyDigest(el) },
  goal: { html: '', init: (el) => window.HD_GOAL && HD_GOAL.renderGoalCard(el) },
  agenda: { html: '', init: (el) => renderAgenda(el) },
  notesShopping: { html: '', init: (el) => renderMiniNotesAndShopping(el) },
};

function sidebarCardHtml(id) {
  const def = SIDEBAR_CARD_DEFS[id];
  if (!def) return '';
  return `
    <section class="card ${def.className || ''}" data-card-id="${id}">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <div class="card-content">${def.html}</div>
    </section>`;
}

async function renderDashboardTab(main) {
  const order = window.HD_LAYOUT ? HD_LAYOUT.getSidebarOrder() : Object.keys(SIDEBAR_CARD_DEFS);

  main.innerHTML = `
    <div class="dashboard-toolbar">
      <button type="button" id="edit-layout-btn">✥ Rearrange boxes</button>
    </div>
    <div class="dashboard-grid" id="dashboard-grid">
      <section class="dashboard-calendar card" id="dash-calendar" data-card-id="calendar"></section>
      <aside class="dashboard-side" id="dashboard-side">
        ${order.map(sidebarCardHtml).join('')}
      </aside>
    </div>`;

  const calendarEl = document.getElementById('dash-calendar');
  const sideEl = document.getElementById('dashboard-side');
  const gridEl = document.getElementById('dashboard-grid');

  document.getElementById('edit-layout-btn').addEventListener('click', (ev) => {
    const on = window.HD_LAYOUT ? HD_LAYOUT.toggleEditMode(gridEl) : false;
    ev.target.textContent = on ? '✓ Done rearranging' : '✥ Rearrange boxes';
  });

  function cardContent(id) {
    const card = sideEl.querySelector(`[data-card-id="${id}"]`);
    return card ? card.querySelector('.card-content') : null;
  }

  function refreshAll() {
    HD_CAL.renderCalendar(calendarEl, onDayClick);
    const agendaContent = cardContent('agenda');
    if (agendaContent) renderAgenda(agendaContent);
    const tripContent = cardContent('trip');
    if (tripContent) renderTripCountdown(tripContent);
  }

  function onDayClick(dateStr) {
    openEventModal(dateStr, refreshAll);
  }

  HD_CAL.renderCalendar(calendarEl, onDayClick);

  order.forEach((id) => {
    const def = SIDEBAR_CARD_DEFS[id];
    const el = cardContent(id);
    if (def && el) def.init(el);
  });

  if (window.HD_LAYOUT) {
    HD_LAYOUT.trackResize(calendarEl, 'calendar');
    sideEl.querySelectorAll('.card[data-card-id]').forEach((el) => HD_LAYOUT.trackResize(el, el.dataset.cardId));
    HD_LAYOUT.enableSidebarDrag(sideEl, (newOrder) => HD_LAYOUT.saveSidebarOrder(newOrder));
  }
}

window.HD_DASHBOARD = { renderDashboardTab };
