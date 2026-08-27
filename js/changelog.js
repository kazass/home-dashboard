const APP_VERSION = '2.3.1';

// Newest first. Add one entry here each time a real update ships.
// Versioning: major.minor.patch, but minor/patch aren't semantic — they're a
// time bucket. Same hour as the last entry -> bump patch (2.1.1 -> 2.1.2).
// Hour changes -> bump minor and reset patch to 1 (2.1.3 -> 2.2.1). Major
// only moves for genuinely big batches, at your judgment.
const CHANGELOG = [
  {
    version: '2.3.1',
    date: '2026-08-27',
    notes: [
      'Made backup restore validated and transactional so a bad file cannot leave the dashboard half-erased; backups now include settings and layout.',
      'Fixed duplicate points from completing, undoing, and recompleting the same task, and blocked duplicate same-day chore credit.',
      'Fixed monthly schedules on the 29th–31st skipping into the following month.',
      'Hardened user names and pasted links before rendering them.',
      'Fixed photo-preview memory accumulating during long tablet sessions and requested persistent browser storage.',
    ],
  },
  {
    version: '2.2.2',
    date: '2026-08-24',
    notes: [
      'Merged the "This week" digest into the Agenda card (renamed "Today & this week") — one summary instead of two overlapping cards.',
      'Replaced the hourly due-today popup with a quiet badge in the corner — tap it to see/act on what\'s due, no more auto-interrupting popup.',
      'Trimmed clutter on chore/task/idea rows — secondary info (recurrence, "when", tags, points) now sits on a smaller line under the title instead of crowding it.',
      'Added per-card show/hide toggles for the dashboard sidebar in Settings.',
    ],
  },
  {
    version: '2.2.1',
    date: '2026-08-24',
    notes: [
      'You can now rename Kasparas/Izolda in Settings → Manage users — renaming updates every existing chore, task, and rating automatically.',
      'Chores and Home/Work tasks can now have points and build an on-time streak; a new Leaderboard section in the Stats panel shows who\'s ahead.',
      'Home/Work tasks can now have an optional due date.',
      'Added an hourly “today\'s status” popup for anything due/overdue, with a Postpone 1/2/3 days option — turn it off in Settings if it\'s too naggy.',
      'Added an Activities dashboard card for tracking free-form personal habits (workout, read, etc.), with weekly/total counts in the Stats panel.',
      'Hidden: the version-button easter egg now offers a quick memory-match game.',
    ],
  },
  {
    version: '2.1.4',
    date: '2026-08-24',
    notes: [
      'Fixed a root cause of updates sometimes taking a while to show up on the tablet: GitHub Pages serves files with a 10-minute cache, so the app could keep re-fetching a stale copy of itself even after a new version was live. Updates now always fetch fresh.',
    ],
  },
  {
    version: '2.1.3',
    date: '2026-08-24',
    notes: [
      'Fixed dashboard cards still showing near-empty/collapsed after the overlap fix — cards now have a minimum size no matter how small a past resize got stuck at.',
      'Release notes now mark each line 🛠️ fix or ✨ feature.',
    ],
  },
  {
    version: '2.1.2',
    date: '2026-08-24',
    notes: [
      'Fixed dashboard sidebar cards visually overlapping when a card\'s saved size was smaller than its content — cards now scroll internally instead of bleeding onto the cards below.',
    ],
  },
  {
    version: '2.1.1',
    date: '2026-08-24',
    notes: [
      'Fixed "Rearrange boxes" losing sync after leaving and returning to the Dashboard tab.',
      'Added a swipeable Stats panel (swipe in from the right edge, or tap the 📊 tab) showing chores by person, this month\'s completed tasks/ideas, and chore streaks.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-08-24',
    notes: [
      'Dashboard boxes (calendar, weather, agenda, etc.) can now be rearranged and resized — tap "Rearrange boxes" to drag/resize, reset anytime in Settings. The nav sidebar is resizable too.',
      'Chore progress now shows as a 5-star row instead of a plain count.',
      'Added a List view to the calendar (30-day agenda-style scroll) alongside Month/Week.',
      'Added a "This week" digest card summarizing chores/trips/tasks due.',
      'Added a freeform family goal tracker card with a progress bar.',
      'Backup now includes a one-way "Export calendar (.ics)" for importing events into Google/Apple/Outlook calendar.',
    ],
  },
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
        <button type="button" id="play-game-btn">🎮 Play a quick game</button>
      </div>
    </div>`;
  overlay.querySelector('#changelog-close-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#play-game-btn').addEventListener('click', () => {
    overlay.remove();
    if (window.HD_GAME) HD_GAME.openGameModal();
  });
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
            <ul>${entry.notes.map((n) => `<li>${n.toLowerCase().startsWith('fixed') ? '🛠️' : '✨'} ${HD_CAL.escapeHtml(n)}</li>`).join('')}</ul>
          </div>`).join('')}
      </div>
    </div>`;

  overlay.querySelector('#changelog-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

window.HD_CHANGELOG = { APP_VERSION, CHANGELOG, openChangelogModal };
