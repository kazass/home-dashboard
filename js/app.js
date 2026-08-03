const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'notes', label: 'Notes' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'homework', label: 'Home/Work' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'garden', label: 'Garden' },
  { id: 'recipes', label: 'Recipes' },
];

function renderNav() {
  const nav = document.getElementById('nav');
  const version = window.HD_CHANGELOG ? window.HD_CHANGELOG.APP_VERSION : '';
  nav.innerHTML = TABS.map(t =>
    `<button class="nav-btn" data-tab="${t.id}">${t.label}</button>`
  ).join('')
    + '<button class="nav-btn nav-utility-btn" id="backup-nav-btn">Backup</button>'
    + `<button class="nav-btn nav-utility-btn nav-version-btn" id="version-nav-btn">v${version}</button>`;
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    if (btn.id === 'backup-nav-btn') {
      if (window.HD_BACKUP) window.HD_BACKUP.openBackupModal();
      return;
    }
    if (btn.id === 'version-nav-btn') {
      if (window.HD_CHANGELOG) window.HD_CHANGELOG.openChangelogModal();
      return;
    }
    location.hash = btn.dataset.tab;
  });
}

function renderPlaceholder(tabId) {
  const main = document.getElementById('main');
  const tab = TABS.find(t => t.id === tabId) || TABS[0];
  main.innerHTML = `
    <div class="placeholder">
      <h2>${tab.label}</h2>
      <p>Coming soon — this tab is built in a later phase.</p>
    </div>`;
}

function setActive(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  const main = document.getElementById('main');
  if (tabId === 'dashboard' && window.HD_DASHBOARD) {
    window.HD_DASHBOARD.renderDashboardTab(main);
  } else if (tabId === 'notes' && window.HD_NOTES) {
    window.HD_NOTES.renderNotesTab(main);
  } else if (tabId === 'shopping' && window.HD_SHOPPING) {
    window.HD_SHOPPING.renderShoppingTab(main);
  } else if (tabId === 'homework' && window.HD_HOMEWORK) {
    window.HD_HOMEWORK.renderHomeWorkTab(main);
  } else if (tabId === 'scheduling' && window.HD_SCHEDULING) {
    window.HD_SCHEDULING.renderSchedulingTab(main);
  } else if (tabId === 'maintenance' && window.HD_MAINTENANCE) {
    window.HD_MAINTENANCE.renderMaintenanceTab(main);
  } else if (tabId === 'ideas' && window.HD_IDEAS) {
    window.HD_IDEAS.renderIdeasTab(main);
  } else if (tabId === 'garden' && window.HD_GARDEN) {
    window.HD_GARDEN.renderGardenTab(main);
  } else if (tabId === 'recipes' && window.HD_RECIPES) {
    window.HD_RECIPES.renderRecipesTab(main);
  } else {
    renderPlaceholder(tabId);
  }
}

function route() {
  const tabId = location.hash.replace('#', '') || 'dashboard';
  setActive(tabId);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  renderNav();
  route();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
