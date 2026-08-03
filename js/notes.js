async function renderNotesTab(main) {
  main.innerHTML = `
    <div class="tab-header"><h2>Notes</h2></div>
    <form id="note-form" class="inline-form">
      <textarea name="text" placeholder="Write a note…" required></textarea>
      <button type="submit">Add note</button>
    </form>
    <div id="notes-list" class="notes-list"></div>`;

  const listEl = document.getElementById('notes-list');

  async function refresh() {
    const notes = await HD_DB.dbGetAll('notes');
    notes.sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));

    listEl.innerHTML = notes.length
      ? notes.map((n) => `
        <div class="note-card ${n.pinned ? 'pinned' : ''}" data-id="${n.id}">
          <div class="note-text">${HD_CAL.escapeHtml(n.text)}</div>
          <div class="note-meta">
            <span class="text-muted">${new Date(n.createdAt).toLocaleString()}</span>
            <div class="note-actions">
              <button type="button" data-pin="${n.id}">${n.pinned ? 'Unpin' : 'Pin'}</button>
              <button type="button" data-edit="${n.id}">Edit</button>
              <button type="button" data-delete="${n.id}">Delete</button>
            </div>
          </div>
        </div>`).join('')
      : '<p class="text-muted">No notes yet.</p>';

    listEl.querySelectorAll('[data-pin]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const note = notes.find((n) => n.id === btn.dataset.pin);
        note.pinned = !note.pinned;
        await HD_DB.dbPut('notes', note);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this note?')) return;
        await HD_DB.dbDelete('notes', btn.dataset.delete);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const note = notes.find((n) => n.id === btn.dataset.edit);
        const card = listEl.querySelector(`[data-id="${note.id}"]`);
        card.innerHTML = `
          <form class="inline-form">
            <textarea name="text">${HD_CAL.escapeHtml(note.text)}</textarea>
            <div class="modal-form-actions">
              <button type="button" data-cancel>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>`;
        card.querySelector('[data-cancel]').addEventListener('click', refresh);
        card.querySelector('form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const text = new FormData(ev.target).get('text').trim();
          if (!text) return;
          note.text = text;
          note.updatedAt = Date.now();
          await HD_DB.dbPut('notes', note);
          refresh();
        });
      });
    });
  }

  document.getElementById('note-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = new FormData(ev.target).get('text').trim();
    if (!text) return;
    await HD_DB.dbPut('notes', { id: crypto.randomUUID(), text, pinned: false, createdAt: Date.now() });
    ev.target.reset();
    refresh();
  });

  refresh();
}

window.HD_NOTES = { renderNotesTab };
