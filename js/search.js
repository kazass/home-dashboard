async function collectSearchIndex() {
  const index = [];

  (await HD_DB.dbGetAll('notes')).forEach((n) => index.push({ tab: 'notes', label: 'Notes', text: n.text }));
  (await HD_DB.dbGetAll('shoppingItems')).forEach((i) => index.push({ tab: 'shopping', label: 'Shopping', text: i.item }));
  (await HD_DB.dbGetAll('homeWork')).forEach((t) => index.push({ tab: 'tasks', label: 'Tasks · To-do', text: t.title }));
  (await HD_DB.dbGetAll('scheduling')).forEach((s) => index.push({
    tab: 'tasks', label: s.category === 'chore' ? 'Tasks · Chores' : 'Tasks · Plans', text: s.title,
  }));
  (await HD_DB.dbGetAll('ideas')).forEach((i) => index.push({ tab: 'ideas', label: 'Ideas', text: i.title }));
  (await HD_DB.dbGetAll('plants')).forEach((p) => index.push({ tab: 'garden', label: 'Garden', text: p.name }));
  (await HD_DB.dbGetAll('recipes')).forEach((r) => index.push({ tab: 'recipes', label: 'Recipes', text: r.title }));
  (await HD_DB.dbGetAll('events')).forEach((e) => index.push({ tab: 'dashboard', label: 'Calendar', text: e.title }));

  return index;
}

function openSearchModal() {
  let overlay = document.getElementById('search-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'search-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Search</h3>
        <button class="modal-close" id="search-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <input type="text" id="search-input" placeholder="Search everything…" autofocus>
        <div id="search-results" class="agenda-list"></div>
      </div>
    </div>`;

  overlay.querySelector('#search-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const input = overlay.querySelector('#search-input');
  const resultsEl = overlay.querySelector('#search-results');

  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      resultsEl.innerHTML = '<p class="text-muted">Type at least 2 characters.</p>';
      return;
    }
    const index = await collectSearchIndex();
    const matches = index.filter((item) => item.text && item.text.toLowerCase().includes(q));
    resultsEl.innerHTML = matches.length
      ? `<ul class="mini-list">${matches.map((m) => `<li><a href="#${m.tab}" class="mini-link" data-result>${HD_CAL.escapeHtml(m.text)} <span class="badge">${m.label}</span></a></li>`).join('')}</ul>`
      : '<p class="text-muted">No matches.</p>';
    resultsEl.querySelectorAll('[data-result]').forEach((a) => a.addEventListener('click', () => overlay.remove()));
  });

  setTimeout(() => input.focus(), 50);
}

window.HD_SEARCH = { openSearchModal };
