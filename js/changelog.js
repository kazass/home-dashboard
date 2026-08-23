const APP_VERSION = '1.9.0';

// Newest first. Add one entry here each time a real update ships.
const CHANGELOG = [
  {
    version: '1.9.0',
    date: '2026-08-24',
    notes: [
      'Assigned-to badges are now colored per person (set colors in Settings) instead of plain text, everywhere in the app.',
      'Screensaver can now cycle your own uploaded photos behind the clock — add them in Settings.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-23',
    notes: [
      'Added a Spotify player at the bottom of the sidebar — paste a playlist/album/track link in Settings. Plain embed, not tied to the tablet\'s account.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-23',
    notes: [
      'Trip countdown is now a live ticking clock (days/hours/minutes/seconds), not just a day count.',
      'Added 5 full Settings themes (Forest, Ocean, Sunset, Lavender, Slate) — the accent color picker still layers on top of whichever theme you pick.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-23',
    notes: [
      'Added accent color picker in Settings.',
      'Added a Search button that searches across every tab at once.',
      'Chores can now auto-rotate between Kasparas and Izolda each time marked done.',
      'Added a trip countdown widget on the Dashboard.',
      'There may or may not be a hidden surprise on the version button. 🎉',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-23',
    notes: [
      'Merged Home/Work, Scheduling, and Maintenance into one Tasks tab (To-do / Recurring chores / Recurring plans) — 7 tabs instead of 9.',
      'Simplified calendar chip colors from 7 to 3, using icons for sub-type instead.',
      'Completed-item chips on the calendar grid are now a Settings toggle (off by default); the day popup still always shows them.',
      'Merged the Notes and Shopping dashboard previews into one card.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-23',
    notes: [
      'Completed tasks, ideas, and chores now show as a checkmark chip on the calendar (on the day they were finished) and in the day popup.',
      'Every list (Shopping, Home/Work, Scheduling, Maintenance, Ideas, Garden, Recipes) can now be edited in place, not just added to and deleted.',
      'Added a Settings button to make the screensaver idle timeout adjustable instead of fixed at 3 minutes.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-09',
    notes: [
      'Added an idle ambient screensaver: after 3 minutes of no activity, a full-screen clock, date, and weather appear; any tap returns to the app.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-04',
    notes: [
      'Combined "random task" and "random cleaning task" into one "random home chore" picker (pools Home/Work tasks and Maintenance chores together).',
      'Added this version/release notes button.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-04',
    notes: [
      'Added "Help me decide" dashboard widget: customizable coin flip, random task picker, random cleaning task picker, random activity picker.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-03',
    notes: [
      'Initial release: calendar with month/week views, recurring schedules, chores, and plant watering merged in; agenda; weather; holidays.',
      'Notes, Shopping list, Home/Work task backlog, Scheduling, Maintenance (with completion tracking), Ideas, Garden (with photos), Recipes with per-person ratings and a Meal Planner.',
      'JSON backup/restore, offline support, deployed as an installable PWA.',
    ],
  },
];

let easterEggClicks = [];

function checkEasterEgg() {
  const now = Date.now();
  easterEggClicks = easterEggClicks.filter((t) => now - t < 2500);
  easterEggClicks.push(now);
  if (easterEggClicks.length >= 5) {
    easterEggClicks = [];
    return true;
  }
  return false;
}

function launchConfetti() {
  const colors = ['#4f7fc7', '#c74f5c', '#3f9e8f', '#b0762f', '#a44fb0'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${2 + Math.random() * 1.5}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

function openEasterEggModal() {
  let overlay = document.getElementById('changelog-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'changelog-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>🎉 You found it!</h3>
        <button class="modal-close" id="changelog-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p>Built with ❤️ for Kasparas &amp; Izolda. Here's to fewer forgotten chores.</p>
      </div>
    </div>`;
  overlay.querySelector('#changelog-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  launchConfetti();
}

function openChangelogModal() {
  if (checkEasterEgg()) {
    openEasterEggModal();
    return;
  }
  let overlay = document.getElementById('changelog-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'changelog-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Home Dashboard — v${APP_VERSION}</h3>
        <button class="modal-close" id="changelog-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        ${CHANGELOG.map((entry) => `
          <div class="changelog-entry">
            <h4>v${entry.version} <span class="text-muted">— ${entry.date}</span></h4>
            <ul>${entry.notes.map((n) => `<li>${HD_CAL.escapeHtml(n)}</li>`).join('')}</ul>
          </div>`).join('')}
      </div>
    </div>`;

  overlay.querySelector('#changelog-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

window.HD_CHANGELOG = { APP_VERSION, CHANGELOG, openChangelogModal };
