// Free-form personal habits (workout, read, etc.) — distinct from chores/
// tasks, tracked purely for stats. Logging reuses the shared completions log
// (itemType:'activity') but always at 0 points, so it never touches the
// chore/task leaderboard.
async function getActivities() {
  const activities = await HD_DB.dbGetAll('activities');
  return activities.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

async function renderActivitiesCard(container) {
  async function render() {
    const activities = await getActivities();
    const names = HD_SETTINGS.getUserNames();

    container.innerHTML = `
      <h4>Activities</h4>
      ${activities.length ? activities.map((a) => `
        <div class="activity-row">
          <span class="task-title">${HD_CAL.escapeHtml(a.name)}</span>
          <div class="activity-log-btns">
            ${names.map((n) => `<button type="button" class="activity-log-btn" data-log="${a.id}" data-person="${HD_CAL.escapeHtml(n)}">+1 ${HD_CAL.escapeHtml(n)}</button>`).join('')}
            <button type="button" class="activity-delete-btn" data-delete-activity="${a.id}" aria-label="Delete">&times;</button>
          </div>
        </div>`).join('') : '<p class="text-muted">No activities yet.</p>'}
      <form id="add-activity-form" class="inline-form">
        <input name="name" placeholder="+ Add activity (e.g. Workout)" required>
        <button type="submit">Add</button>
      </form>`;

    container.querySelectorAll('[data-log]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await HD_POINTS.logCompletion({
          itemType: 'activity', itemId: btn.dataset.log, person: btn.dataset.person, points: 0,
        });
        btn.textContent = '✓ logged';
        setTimeout(render, 600);
      });
    });

    container.querySelectorAll('[data-delete-activity]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this activity?')) return;
        await HD_DB.dbDelete('activities', btn.dataset.deleteActivity);
        render();
      });
    });

    container.querySelector('#add-activity-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const name = fd.get('name').trim();
      if (!name) return;
      await HD_DB.dbPut('activities', { id: crypto.randomUUID(), name, createdAt: Date.now() });
      render();
    });
  }

  render();
}

window.HD_ACTIVITIES = { getActivities, renderActivitiesCard };
