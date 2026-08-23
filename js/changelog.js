const APP_VERSION = '1.4.0';

// Newest first. Add one entry here each time a real update ships.
const CHANGELOG = [
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

function openChangelogModal() {
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
