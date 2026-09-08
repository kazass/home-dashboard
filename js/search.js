async function collectSearchIndex() {
  const definitions=[['notes','notes','Notes',r=>r.text],['shoppingItems','shopping','Shopping',r=>r.item],['homeWork','tasks','Tasks',r=>r.title],['scheduling','tasks','Tasks & plans',r=>r.title],['ideas','ideas','Ideas',r=>r.title],['plants','garden','Garden',r=>r.name],['recipes','recipes','Recipes',r=>r.title],['events','calendar','Calendar',r=>r.title],['sales','sales/all','Sales & parcels',r=>[r.title,r.location].filter(Boolean).join(' · ')]];
  return (await Promise.all(definitions.map(async([store,tab,label,toText])=>(await HD_DB.dbGetAll(store)).map(record=>({tab,label,text:toText(record)}))))).flat();
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

  let searchSequence=0;
  input.addEventListener('input', async () => {
    const current=++searchSequence;
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      resultsEl.innerHTML = '<p class="text-muted">Type at least 2 characters.</p>';
      return;
    }
    let index;
    try { index = await collectSearchIndex(); } catch { resultsEl.textContent="Search is unavailable. Please try again."; return; }
    if(current!==searchSequence||!overlay.isConnected)return;
    const matches = index.filter((item) => item.text && item.text.toLowerCase().includes(q));
    resultsEl.innerHTML = matches.length
      ? `<ul class="mini-list">${matches.map((m) => `<li><a href="#${m.tab}" class="mini-link" data-result>${HD_CAL.escapeHtml(m.text)} <span class="badge">${m.label}</span></a></li>`).join('')}</ul>`
      : '<p class="text-muted">No matches.</p>';
    resultsEl.querySelectorAll('[data-result]').forEach((a) => a.addEventListener('click', () => overlay.remove()));
  });

  setTimeout(() => input.focus(), 50);
}

window.HD_SEARCH = { openSearchModal };
