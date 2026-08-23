const HOMEWORK_ASSIGNEES = ['Both', 'Kasparas', 'Izolda'];

async function renderHomeWorkContent(main) {
  main.innerHTML = `
    <p class="text-muted">One-off things around the house — not on a repeating schedule.</p>
    <form id="homework-form" class="inline-form">
      <input name="title" placeholder="Task (e.g. Fix the fence)" required>
      <input name="when" placeholder="When (optional, e.g. next winter)">
      <select name="assignedTo">${HOMEWORK_ASSIGNEES.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
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
        <select name="assignedTo">${HOMEWORK_ASSIGNEES.map((a) => `<option value="${a}" ${a === t.assignedTo ? 'selected' : ''}>${a}</option>`).join('')}</select>
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
      ? tasks.map((t) => t.id === editingId ? editFormHtml(t) : `
        <div class="task-row ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
          <label class="task-row-main">
            <input type="checkbox" data-toggle="${t.id}" ${t.status === 'done' ? 'checked' : ''}>
            <span class="task-title">${HD_CAL.escapeHtml(t.title)}</span>
            ${t.when ? `<span class="badge">${HD_CAL.escapeHtml(t.when)}</span>` : ''}
            <span class="badge">${t.assignedTo || 'Both'}</span>
          </label>
          ${t.notes ? `<div class="task-notes text-muted">${HD_CAL.escapeHtml(t.notes)}</div>` : ''}
          <div class="task-actions">
            <button type="button" data-edit="${t.id}">Edit</button>
            <button type="button" data-delete="${t.id}">Delete</button>
          </div>
        </div>`).join('')
      : '<p class="text-muted">No home tasks yet.</p>';

    listEl.querySelectorAll('[data-toggle]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const task = tasks.find((t) => t.id === cb.dataset.toggle);
        task.status = cb.checked ? 'done' : 'todo';
        if (cb.checked) {
          const completedDate = new Date();
          completedDate.setHours(0, 0, 0, 0);
          task.completedAt = completedDate.getTime();
        } else {
          task.completedAt = null;
        }
        await HD_DB.dbPut('homeWork', task);
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
      assignedTo: fd.get('assignedTo'),
      notes: fd.get('notes').trim(),
      status: 'todo',
      createdAt: Date.now(),
    });
    ev.target.reset();
    refresh();
  });

  refresh();
}

window.HD_HOMEWORK = { renderHomeWorkContent };
