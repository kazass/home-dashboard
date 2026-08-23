function streakHtml(count) {
  const filled = Math.min(5, count);
  const stars = Array.from({ length: 5 }, (_, i) => `<span class="streak-star ${i < filled ? 'filled' : ''}">★</span>`).join('');
  return `<span class="streak-stars">${stars}</span>`;
}

async function renderMaintenanceContent(main) {
  main.innerHTML = `
    <p class="text-muted">Recurring home chores.</p>
    <form id="chore-form" class="inline-form">
      <input name="title" placeholder="Chore (e.g. Wash towels)" required>
      <input type="number" name="intervalCount" min="1" value="1" style="width:70px">
      <select name="intervalUnit">
        <option value="days">Days</option>
        <option value="weeks" selected>Weeks</option>
        <option value="months">Months</option>
      </select>
      <input type="number" name="points" min="0" value="1" style="width:60px" placeholder="Pts">
      <select name="assignedTo">${HD_SETTINGS.getAssigneeOptions().map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
      <label class="settings-checkbox"><input type="checkbox" name="rotate"> Rotate between users each time</label>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button type="submit">Add chore</button>
    </form>
    <div id="chore-list"></div>`;

  const listEl = document.getElementById('chore-list');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function dueBadge(due) {
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return `<span class="task-due overdue">Overdue by ${-diffDays}d</span>`;
    if (diffDays === 0) return '<span class="task-due due-today">Due today</span>';
    return `<span class="task-due">Due in ${diffDays}d</span>`;
  }

  let editingId = null;

  function editFormHtml(c) {
    return `
      <form class="item-edit-form" data-edit-form="${c.id}">
        <input name="title" value="${HD_CAL.escapeHtml(c.title)}" required>
        <div class="recurrence-fields">
          <input type="number" name="intervalCount" min="1" value="${c.intervalCount}" style="width:70px">
          <select name="intervalUnit">
            <option value="days" ${c.intervalUnit === 'days' ? 'selected' : ''}>Days</option>
            <option value="weeks" ${c.intervalUnit === 'weeks' ? 'selected' : ''}>Weeks</option>
            <option value="months" ${c.intervalUnit === 'months' ? 'selected' : ''}>Months</option>
          </select>
        </div>
        <input type="number" name="points" min="0" value="${c.points || 1}" style="width:60px" placeholder="Pts">
        <select name="assignedTo">${HD_SETTINGS.getAssigneeOptions().map((a) => `<option value="${a}" ${a === c.assignedTo ? 'selected' : ''}>${a}</option>`).join('')}</select>
        <label class="settings-checkbox"><input type="checkbox" name="rotate" ${c.rotate ? 'checked' : ''}> Rotate between users each time</label>
        <textarea name="notes" placeholder="Notes (optional)">${HD_CAL.escapeHtml(c.notes || '')}</textarea>
        <div class="modal-form-actions">
          <button type="button" data-cancel-edit>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>`;
  }

  async function refresh() {
    const all = await HD_DB.dbGetAll('scheduling');
    const chores = all.filter((s) => s.category === 'chore');
    chores.sort((a, b) => HD_SCHEDULING.choreNextDue(a) - HD_SCHEDULING.choreNextDue(b));

    listEl.innerHTML = chores.length
      ? chores.map((c) => {
        if (c.id === editingId) return editFormHtml(c);
        const due = HD_SCHEDULING.choreNextDue(c);
        return `
          <div class="task-row" data-id="${c.id}">
            <div class="task-row-main">
              <span class="task-title">${HD_CAL.escapeHtml(c.title)}</span>
              ${HD_SETTINGS.personBadgeHtml(c.assignedTo)}
              ${dueBadge(due)}
            </div>
            <div class="task-meta text-muted">${HD_SCHEDULING.describeRecurrence(c)}${c.rotate ? ' · 🔁 rotates' : ''}</div>
            <div class="streak-row">
              ${streakHtml(c.completedCount || 0)}
              <span class="text-muted">${c.completedCount || 0}×${c.lastDoneAt ? ' — last done ' + new Date(c.lastDoneAt).toLocaleDateString() : ''} — ${c.points || 1}pt${(c.points || 1) === 1 ? '' : 's'}${c.currentStreak > 1 ? `, 🔥${c.currentStreak} streak` : ''}</span>
            </div>
            ${c.notes ? `<div class="task-notes text-muted">${HD_CAL.escapeHtml(c.notes)}</div>` : ''}
            <div class="task-actions">
              <button type="button" data-done="${c.id}">Mark done</button>
              <button type="button" data-edit="${c.id}">Edit</button>
              <button type="button" data-delete="${c.id}">Delete</button>
            </div>
          </div>`;
      }).join('')
      : '<p class="text-muted">No chores yet.</p>';

    listEl.querySelectorAll('[data-done]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const chore = chores.find((c) => c.id === btn.dataset.done);
        const due = HD_SCHEDULING.choreNextDue(chore);
        const doneAt = new Date();
        doneAt.setHours(0, 0, 0, 0);
        const onTime = !chore.lastDoneAt || doneAt <= due;
        const creditedTo = chore.assignedTo;
        chore.currentStreak = onTime ? (chore.currentStreak || 0) + 1 : 1;
        chore.lastDoneAt = doneAt.getTime();
        chore.completedCount = (chore.completedCount || 0) + 1;
        if (chore.rotate) {
          const names = HD_SETTINGS.getUserNames();
          const idx = names.indexOf(chore.assignedTo);
          if (idx >= 0) chore.assignedTo = names[(idx + 1) % names.length];
        }
        await HD_DB.dbPut('scheduling', chore);
        if (window.HD_POINTS) {
          await HD_POINTS.logCompletion({
            itemType: 'chore', itemId: chore.id, person: creditedTo,
            points: (chore.points || 1) + HD_POINTS.streakBonus(chore.currentStreak),
          });
        }
        refresh();
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this chore?')) return;
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

    listEl.querySelectorAll('[data-edit-form]').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const id = form.dataset.editForm;
        const chore = chores.find((c) => c.id === id);
        const fd = new FormData(form);
        const title = fd.get('title').trim();
        if (!title) return;
        chore.title = title;
        chore.intervalCount = Number(fd.get('intervalCount')) || 1;
        chore.intervalUnit = fd.get('intervalUnit');
        chore.assignedTo = fd.get('assignedTo');
        chore.rotate = fd.get('rotate') === 'on';
        chore.points = Number(fd.get('points')) || 1;
        chore.notes = fd.get('notes').trim();
        await HD_DB.dbPut('scheduling', chore);
        editingId = null;
        refresh();
      });
    });
  }

  document.getElementById('chore-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const title = fd.get('title').trim();
    if (!title) return;
    const anchorToday = new Date();
    anchorToday.setHours(0, 0, 0, 0);
    await HD_DB.dbPut('scheduling', {
      id: crypto.randomUUID(),
      title,
      category: 'chore',
      assignedTo: fd.get('assignedTo'),
      rotate: fd.get('rotate') === 'on',
      points: Number(fd.get('points')) || 1,
      recurrenceKind: 'interval',
      intervalCount: Number(fd.get('intervalCount')) || 1,
      intervalUnit: fd.get('intervalUnit'),
      nth: 1,
      weekday: 0,
      anchorDate: HD_CAL.ymd(anchorToday),
      notes: fd.get('notes').trim(),
      lastDoneAt: null,
      completedCount: 0,
      currentStreak: 0,
      postponedUntil: null,
      createdAt: Date.now(),
    });
    ev.target.reset();
    refresh();
  });

  refresh();
}

window.HD_MAINTENANCE = { renderMaintenanceContent, streakHtml };
