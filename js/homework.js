const HOMEWORK_ASSIGNEES = ['Both', 'Kasparas', 'Izolda'];

async function renderHomeWorkTab(main) {
  main.innerHTML = `
    <div class="tab-header"><h2>Home/Work</h2><p class="text-muted">Things around the house that need fixing, cleaning, or doing — not on a repeating schedule.</p></div>
    <form id="homework-form" class="inline-form">
      <input name="title" placeholder="Task (e.g. Fix the fence)" required>
      <input name="when" placeholder="When (optional, e.g. next winter)">
      <select name="assignedTo">${HOMEWORK_ASSIGNEES.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button type="submit">Add task</button>
    </form>
    <div id="homework-list"></div>`;

  const listEl = document.getElementById('homework-list');

  async function refresh() {
    const tasks = await HD_DB.dbGetAll('homeWork');
    tasks.sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.createdAt - a.createdAt));

    listEl.innerHTML = tasks.length
      ? tasks.map((t) => `
        <div class="task-row ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
          <label class="task-row-main">
            <input type="checkbox" data-toggle="${t.id}" ${t.status === 'done' ? 'checked' : ''}>
            <span class="task-title">${HD_CAL.escapeHtml(t.title)}</span>
            ${t.when ? `<span class="badge">${HD_CAL.escapeHtml(t.when)}</span>` : ''}
            <span class="badge">${t.assignedTo || 'Both'}</span>
          </label>
          ${t.notes ? `<div class="task-notes text-muted">${HD_CAL.escapeHtml(t.notes)}</div>` : ''}
          <div class="task-actions">
            <button type="button" data-delete="${t.id}">Delete</button>
          </div>
        </div>`).join('')
      : '<p class="text-muted">No home tasks yet.</p>';

    listEl.querySelectorAll('[data-toggle]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const task = tasks.find((t) => t.id === cb.dataset.toggle);
        task.status = cb.checked ? 'done' : 'todo';
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

window.HD_HOMEWORK = { renderHomeWorkTab };
