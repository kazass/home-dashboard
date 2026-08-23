let tasksSubView = 'todo';

async function renderTasksTab(main) {
  main.innerHTML = `
    <div class="tab-header">
      <h2>Tasks</h2>
      <div class="sub-nav">
        <button type="button" class="sub-nav-btn" data-sub="todo">To-do</button>
        <button type="button" class="sub-nav-btn" data-sub="chores">Recurring chores</button>
        <button type="button" class="sub-nav-btn" data-sub="plans">Recurring plans</button>
      </div>
    </div>
    <div id="tasks-content"></div>`;

  main.querySelectorAll('[data-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tasksSubView = btn.dataset.sub;
      renderSubView();
    });
  });

  function renderSubView() {
    main.querySelectorAll('[data-sub]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sub === tasksSubView);
    });
    const content = document.getElementById('tasks-content');
    if (tasksSubView === 'chores') HD_MAINTENANCE.renderMaintenanceContent(content);
    else if (tasksSubView === 'plans') HD_SCHEDULING.renderPlansContent(content);
    else HD_HOMEWORK.renderHomeWorkContent(content);
  }

  renderSubView();
}

window.HD_TASKS = { renderTasksTab };
