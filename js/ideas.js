const IDEA_ASSIGNEES = ['Both', 'Kasparas', 'Izolda'];

async function renderIdeasTab(main) {
  main.innerHTML = `
    <div class="tab-header"><h2>Ideas</h2><p class="text-muted">Things you might want to do sometime — not tied to a date.</p></div>
    <form id="idea-form" class="inline-form">
      <input name="title" placeholder="Idea (e.g. Visit the botanical garden)" required>
      <input name="when" placeholder="When (optional, e.g. someday, this weekend)">
      <input name="tags" placeholder="Tags (optional, comma-separated, e.g. outdoor, rainy-day)">
      <select name="assignedTo">${IDEA_ASSIGNEES.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button type="submit">Add idea</button>
    </form>
    <div id="ideas-list"></div>`;

  const listEl = document.getElementById('ideas-list');
  let editingId = null;

  function editFormHtml(i) {
    return `
      <form class="item-edit-form" data-edit-form="${i.id}">
        <input name="title" value="${HD_CAL.escapeHtml(i.title)}" required>
        <input name="when" value="${HD_CAL.escapeHtml(i.when || '')}" placeholder="When (optional)">
        <input name="tags" value="${HD_CAL.escapeHtml(i.tags || '')}" placeholder="Tags (optional, comma-separated)">
        <select name="assignedTo">${IDEA_ASSIGNEES.map((a) => `<option value="${a}" ${a === i.assignedTo ? 'selected' : ''}>${a}</option>`).join('')}</select>
        <textarea name="notes" placeholder="Notes (optional)">${HD_CAL.escapeHtml(i.notes || '')}</textarea>
        <div class="modal-form-actions">
          <button type="button" data-cancel-edit>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>`;
  }

  async function refresh() {
    const ideas = await HD_DB.dbGetAll('ideas');
    ideas.sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.createdAt - a.createdAt));

    listEl.innerHTML = ideas.length
      ? ideas.map((i) => i.id === editingId ? editFormHtml(i) : `
        <div class="task-row ${i.status === 'done' ? 'done' : ''}" data-id="${i.id}">
          <label class="task-row-main">
            <input type="checkbox" data-toggle="${i.id}" ${i.status === 'done' ? 'checked' : ''}>
            <span class="task-title">${HD_CAL.escapeHtml(i.title)}</span>
            ${i.when ? `<span class="badge">${HD_CAL.escapeHtml(i.when)}</span>` : ''}
            ${HD_SETTINGS.personBadgeHtml(i.assignedTo)}
            ${(i.tags || '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => `<span class="badge tag">${HD_CAL.escapeHtml(t)}</span>`).join('')}
          </label>
          ${i.notes ? `<div class="task-notes text-muted">${HD_CAL.escapeHtml(i.notes)}</div>` : ''}
          <div class="task-actions">
            <button type="button" data-edit="${i.id}">Edit</button>
            <button type="button" data-delete="${i.id}">Delete</button>
          </div>
        </div>`).join('')
      : '<p class="text-muted">No ideas yet.</p>';

    listEl.querySelectorAll('[data-toggle]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const idea = ideas.find((i) => i.id === cb.dataset.toggle);
        idea.status = cb.checked ? 'done' : 'idea';
        if (cb.checked) {
          const completedDate = new Date();
          completedDate.setHours(0, 0, 0, 0);
          idea.completedAt = completedDate.getTime();
        } else {
          idea.completedAt = null;
        }
        await HD_DB.dbPut('ideas', idea);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this idea?')) return;
        await HD_DB.dbDelete('ideas', btn.dataset.delete);
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
        const idea = ideas.find((i) => i.id === id);
        const fd = new FormData(form);
        const title = fd.get('title').trim();
        if (!title) return;
        idea.title = title;
        idea.when = fd.get('when').trim();
        idea.tags = fd.get('tags').trim();
        idea.assignedTo = fd.get('assignedTo');
        idea.notes = fd.get('notes').trim();
        await HD_DB.dbPut('ideas', idea);
        editingId = null;
        refresh();
      });
    });
  }

  document.getElementById('idea-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const title = fd.get('title').trim();
    if (!title) return;
    await HD_DB.dbPut('ideas', {
      id: crypto.randomUUID(),
      title,
      when: fd.get('when').trim(),
      tags: fd.get('tags').trim(),
      assignedTo: fd.get('assignedTo'),
      notes: fd.get('notes').trim(),
      status: 'idea',
      createdAt: Date.now(),
    });
    ev.target.reset();
    refresh();
  });

  refresh();
}

window.HD_IDEAS = { renderIdeasTab };
