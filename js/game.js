// Pure fun distraction — not part of the points/completions system. Best is
// tracked in localStorage only, no IndexedDB/backup involvement.
const GAME_BEST_KEY = 'hd-game-best-moves';
const GAME_EMOJI = ['🍕', '🎈', '🐸', '🌵', '🚀', '🎧', '🧦', '🍩'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function openGameModal() {
  let overlay = document.getElementById('game-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'game-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  let deck, flipped, matched, moves;

  function newGame() {
    deck = shuffle([...GAME_EMOJI, ...GAME_EMOJI]).map((emoji, i) => ({ id: i, emoji }));
    flipped = [];
    matched = new Set();
    moves = 0;
    render();
  }

  function render() {
    const best = Number(localStorage.getItem(GAME_BEST_KEY) || 0);
    const won = matched.size === deck.length;
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>🎮 Memory match</h3>
          <button class="modal-close" id="game-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="text-muted">Moves: ${moves}${best ? ` · Best: ${best}` : ''}${won ? ' — Solved! 🎉' : ''}</p>
          <div class="memory-grid">
            ${deck.map((card) => {
              const isUp = flipped.includes(card.id) || matched.has(card.id);
              return `<button type="button" class="memory-card ${isUp ? 'flipped' : ''}" data-card="${card.id}" ${matched.has(card.id) ? 'disabled' : ''}>${isUp ? card.emoji : '❓'}</button>`;
            }).join('')}
          </div>
          <div class="modal-form-actions">
            <button type="button" id="game-restart-btn">Restart</button>
          </div>
        </div>
      </div>`;

    overlay.querySelector('#game-close-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#game-restart-btn').addEventListener('click', newGame);

    if (!won) {
      overlay.querySelectorAll('[data-card]').forEach((btn) => {
        btn.addEventListener('click', () => onFlip(Number(btn.dataset.card)));
      });
    } else if (!best || moves < best) {
      localStorage.setItem(GAME_BEST_KEY, String(moves));
    }
  }

  function onFlip(id) {
    if (flipped.length === 2 || flipped.includes(id) || matched.has(id)) return;
    flipped.push(id);
    if (flipped.length === 2) {
      moves++;
      const [a, b] = flipped;
      if (deck[a].emoji === deck[b].emoji) {
        matched.add(a);
        matched.add(b);
        flipped = [];
        render();
      } else {
        render();
        setTimeout(() => { flipped = []; render(); }, 700);
      }
    } else {
      render();
    }
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  newGame();
}

window.HD_GAME = { openGameModal };
