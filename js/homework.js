async function renderHomeWorkContent(main) {
  main.innerHTML = `
    <p class="text-muted">One-off things around the house — not on a repeating schedule.</p>
    <form id="homework-form" class="inline-form">
      <input name="title" placeholder="Task (e.g. Fix the fence)" required>
      <input name="when" placeholder="When (optional, e.g. next winter)">
      <input type="date" name="dueDate" title="Due date (optional) — lets this task appear in the daily status popup">
      <input type="number" name="points" min="0" value="1" style="width:60px" placeholder="Pts">
      <select name="assignedTo">${HD_SETTINGS.assigneeOptionsHtml()}</select>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button type="submit">Add task</button>
    </form>
    <div id="homework-list"></div>`;

  const listEl = document.getElementById('homework-list');
  let editingId = null;

  function editFormHtml(t) {
    return `
      <form class="item-edit-form" data-edit-form="${t.id}">
        <input name="title" value="${HD_CAL.escapeHtml(t.title)}" required>
        <input name="when" value="${HD_CAL.escapeHtml(t.when || '')}" placeholder="When (optional)">
        <input type="date" name="dueDate" value="${t.dueDate || ''}" title="Due date (optional)">
        <input type="number" name="points" min="0" value="${t.points || 1}" style="width:60px" placeholder="Pts">
        <select name="assignedTo">${HD_SETTINGS.assigneeOptionsHtml(t.assignedTo)}</select>
        <textarea name="notes" placeholder="Notes (optional)">${HD_CAL.escapeHtml(t.notes || '')}</textarea>
        <div class="modal-form-actions">
          <button type="button" data-cancel-edit>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>`;
  }

  async function refresh() {
    const tasks = await HD_DB.dbGetAll('homeWork');
    tasks.sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.createdAt - a.createdAt));

    listEl.innerHTML = tasks.length
      ? tasks.map((t) => {
        if (t.id === editingId) return editFormHtml(t);
        const todayKey = HD_CAL.ymd(new Date());
        const dueBadge = t.dueDate
          ? (t.dueDate < todayKey ? '<span class="task-due overdue">Overdue</span>'
            : t.dueDate === todayKey ? '<span class="task-due due-today">Due today</span>'
            : `<span class="task-due">Due ${t.dueDate}</span>`)
          : '';
        const metaParts = [t.when, `${t.points || 1}pt${(t.points || 1) === 1 ? '' : 's'}`].filter(Boolean);
        return `
        <div class="task-row ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
          <label class="task-row-main">
            <input type="checkbox" data-toggle="${t.id}" ${t.status === 'done' ? 'checked' : ''}>
            <span class="task-title">${HD_CAL.escapeHtml(t.title)}</span>
            ${dueBadge}
            ${HD_SETTINGS.personBadgeHtml(t.assignedTo)}
          </label>
          <div class="task-meta text-muted">${metaParts.map((p) => HD_CAL.escapeHtml(p)).join(' · ')}</div>
          ${t.notes ? `<div class="task-notes text-muted">${HD_CAL.escapeHtml(t.notes)}</div>` : ''}
          <div class="task-actions">
            <button type="button" data-edit="${t.id}">Edit</button>
            <button type="button" data-delete="${t.id}">Delete</button>
          </div>
        </div>`;
      }).join('')
      : '<p class="text-muted">No home tasks yet.</p>';

    listEl.querySelectorAll('[data-toggle]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const task = tasks.find((t) => t.id === cb.dataset.toggle);
        task.status = cb.checked ? 'done' : 'todo';
        if (cb.checked) {
          const completedDate = new Date();
          completedDate.setHours(0, 0, 0, 0);
          task.completedAt = completedDate.getTime();
          const onTime = !task.dueDate || task.dueDate >= HD_CAL.ymd(completedDate);
          task.currentStreak = onTime ? (task.currentStreak || 0) + 1 : 1;
          await HD_DB.dbPut('homeWork', task);
          if (window.HD_POINTS) {
            await HD_POINTS.logCompletion({
              itemType: 'homework', itemId: task.id, person: task.assignedTo,
              points: (task.points || 1) + HD_POINTS.streakBonus(task.currentStreak),
            });
          }
        } else {
          task.completedAt = null;
          task.currentStreak = Math.max(0, (task.currentStreak || 0) - 1);
          await HD_DB.dbPut('homeWork', task);
          if (window.HD_POINTS) {
            await HD_POINTS.deleteCompletionsForItem('homework', task.id);
          }
        }
        refresh();
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this task?')) return;
        await HD_DB.dbDelete('homeWork', btn.dataset.delete);
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
        const task = tasks.find((t) => t.id === id);
        const fd = new FormData(form);
        const title = fd.get('title').trim();
        if (!title) return;
        task.title = title;
        task.when = fd.get('when').trim();
        task.dueDate = fd.get('dueDate') || null;
        task.points = Number(fd.get('points')) || 1;
        task.assignedTo = fd.get('assignedTo');
        task.notes = fd.get('notes').trim();
        await HD_DB.dbPut('homeWork', task);
        editingId = null;
        refresh();
      });
    });
  }

  document.getElementById('homework-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const title = fd.get('title').trim();
    if (!title) return;
    await HD_DB.dbPut('homeWork', {
      id: crypto.randomUUID(),
      title,
      when: fd.get('when').trim(),
      dueDate: fd.get('dueDate') || null,
      points: Number(fd.get('points')) || 1,
      assignedTo: fd.get('assignedTo'),
      notes: fd.get('notes').trim(),
      status: 'todo',
      currentStreak: 0,
      postponedUntil: null,
      createdAt: Date.now(),
    });
    ev.target.reset();
    refresh();
  });

  refresh();
}

window.HD_HOMEWORK = { renderHomeWorkContent };
