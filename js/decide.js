async function pickRandomFrom(store, filterFn) {
  const all = await HD_DB.dbGetAll(store);
  const filtered = filterFn ? all.filter(filterFn) : all;
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

const DECIDE_PICKER_CONFIG = {
  task: {
    title: 'Random task',
    store: 'homeWork',
    filter: (t) => t.status !== 'done',
    empty: 'No open home tasks — add some in the Home/Work tab.',
    render: (t) => `<strong>${HD_CAL.escapeHtml(t.title)}</strong>${t.when ? ` <span class="badge">${HD_CAL.escapeHtml(t.when)}</span>` : ''}`,
  },
  activity: {
    title: 'Random activity',
    store: 'ideas',
    filter: (i) => i.status !== 'done',
    empty: 'No open ideas — add some in the Ideas tab.',
    render: (i) => `<strong>${HD_CAL.escapeHtml(i.title)}</strong>`,
  },
  chore: {
    title: 'Random cleaning task',
    store: 'scheduling',
    filter: (s) => s.category === 'chore',
    empty: 'No chores set up yet — add some in the Maintenance tab.',
    render: (c) => `<strong>${HD_CAL.escapeHtml(c.title)}</strong>`,
  },
};

function openDecideModal() {
  let overlay = document.getElementById('decide-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'decide-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  function closeBtnHandler() {
    overlay.querySelector('#decide-close-btn').addEventListener('click', () => overlay.remove());
  }

  function renderMenu() {
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Help me decide</h3>
          <button class="modal-close" id="decide-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body decide-menu">
          <button type="button" data-mode="coin">🪙 Coin flip</button>
          <button type="button" data-mode="task">✅ Random task</button>
          <button type="button" data-mode="activity">🎯 Random activity</button>
          <button type="button" data-mode="chore">🧹 Random cleaning task</button>
        </div>
      </div>`;
    closeBtnHandler();
    overlay.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.mode === 'coin') renderCoin();
        else renderPicker(btn.dataset.mode);
      });
    });
  }

  function renderCoin() {
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Coin flip</h3>
          <button class="modal-close" id="decide-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="coin-labels">
            <input id="coin-a" value="Yes">
            <span class="text-muted">vs</span>
            <input id="coin-b" value="No">
          </div>
          <div class="coin-result" id="coin-result">?</div>
          <div class="modal-form-actions">
            <button type="button" id="decide-back-btn">Back</button>
            <button type="button" id="coin-flip-btn">Flip</button>
          </div>
        </div>
      </div>`;
    closeBtnHandler();
    overlay.querySelector('#decide-back-btn').addEventListener('click', renderMenu);
    overlay.querySelector('#coin-flip-btn').addEventListener('click', () => {
      const a = overlay.querySelector('#coin-a').value.trim() || 'Yes';
      const b = overlay.querySelector('#coin-b').value.trim() || 'No';
      const resultEl = overlay.querySelector('#coin-result');
      const picked = Math.random() < 0.5 ? a : b;
      resultEl.classList.remove('spin');
      resultEl.textContent = '?';
      void resultEl.offsetWidth; // restart animation
      resultEl.classList.add('spin');
      setTimeout(() => { resultEl.textContent = picked; }, 500);
    });
  }

  async function renderPicker(mode) {
    const config = DECIDE_PICKER_CONFIG[mode];

    async function pick() {
      const resultEl = overlay.querySelector('#picker-result');
      if (!resultEl) return;
      const item = await pickRandomFrom(config.store, config.filter);
      resultEl.innerHTML = item ? config.render(item) : `<span class="text-muted">${config.empty}</span>`;
    }

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${config.title}</h3>
          <button class="modal-close" id="decide-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="picker-result" id="picker-result">Rolling…</div>
          <div class="modal-form-actions">
            <button type="button" id="decide-back-btn">Back</button>
            <button type="button" id="picker-again-btn">Pick another</button>
          </div>
        </div>
      </div>`;
    closeBtnHandler();
    overlay.querySelector('#decide-back-btn').addEventListener('click', renderMenu);
    overlay.querySelector('#picker-again-btn').addEventListener('click', pick);
    await pick();
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  renderMenu();
}

window.HD_DECIDE = { openDecideModal, pickRandomFrom };
