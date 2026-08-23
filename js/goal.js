async function getGoal() {
  const goals = await HD_DB.dbGetAll('goals');
  return goals[0] || null;
}

function progressHtml(goal) {
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  return `
    <div class="goal-title">${HD_CAL.escapeHtml(goal.title)}</div>
    <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
    <div class="text-muted">${goal.current} / ${goal.target} ${HD_CAL.escapeHtml(goal.unit || '')} (${pct}%)</div>`;
}

function formHtml(goal) {
  return `
    <form class="item-edit-form" id="goal-form">
      <input name="title" placeholder="Goal (e.g. Trip savings)" value="${goal ? HD_CAL.escapeHtml(goal.title) : ''}" required>
      <input type="number" name="current" placeholder="Current" value="${goal ? goal.current : 0}" step="any">
      <input type="number" name="target" placeholder="Target" value="${goal ? goal.target : ''}" step="any" required>
      <input name="unit" placeholder="Unit (optional, e.g. EUR, km)" value="${goal ? HD_CAL.escapeHtml(goal.unit || '') : ''}">
      <div class="modal-form-actions">
        ${goal ? '<button type="button" id="goal-delete-btn">Delete</button>' : ''}
        <button type="submit">Save</button>
      </div>
    </form>`;
}

async function renderGoalCard(container) {
  async function showView() {
    const g = await getGoal();
    container.innerHTML = g
      ? `<h4>Family goal</h4>${progressHtml(g)}<button type="button" id="goal-edit-btn" class="goal-edit-btn">Edit</button>`
      : '<h4>Family goal</h4><p class="text-muted">No goal set yet.</p><button type="button" id="goal-edit-btn" class="goal-edit-btn">+ Add a goal</button>';
    document.getElementById('goal-edit-btn').addEventListener('click', showForm);
  }

  async function showForm() {
    const g = await getGoal();
    container.innerHTML = `<h4>Family goal</h4>${formHtml(g)}`;
    document.getElementById('goal-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const title = fd.get('title').trim();
      if (!title) return;
      await HD_DB.dbPut('goals', {
        id: g ? g.id : 'main',
        title,
        current: Number(fd.get('current')) || 0,
        target: Number(fd.get('target')) || 1,
        unit: fd.get('unit').trim(),
      });
      showView();
    });
    const delBtn = document.getElementById('goal-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this goal?')) return;
        await HD_DB.dbDelete('goals', g.id);
        showView();
      });
    }
  }

  showView();
}

window.HD_GOAL = { renderGoalCard };
