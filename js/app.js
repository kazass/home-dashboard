const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'notes', label: 'Notes' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'tasks', label: 'Tasks' },
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
    + '<button class="nav-btn nav-utility-btn" id="search-nav-btn">🔍 Search</button>'
    + '<button class="nav-btn nav-utility-btn" id="backup-nav-btn">Backup</button>'
    + '<button class="nav-btn nav-utility-btn" id="settings-nav-btn">Settings</button>'
    + `<button class="nav-btn nav-utility-btn nav-version-btn" id="version-nav-btn">v${version}</button>`
    + '<div id="nav-spotify"></div>';
  updateSpotifyEmbed();
  if (window.HD_LAYOUT) HD_LAYOUT.trackResize(nav, 'nav');
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    if (btn.id === 'search-nav-btn') {
      if (window.HD_SEARCH) window.HD_SEARCH.openSearchModal();
      return;
    }
    if (btn.id === 'backup-nav-btn') {
      if (window.HD_BACKUP) window.HD_BACKUP.openBackupModal();
      return;
    }
    if (btn.id === 'settings-nav-btn') {
      if (window.HD_SETTINGS) window.HD_SETTINGS.openSettingsModal();
      return;
    }
    if (btn.id === 'version-nav-btn') {
      if (window.HD_CHANGELOG) window.HD_CHANGELOG.openChangelogModal();
      return;
    }
    location.hash = btn.dataset.tab;
  });
}

function updateSpotifyEmbed() {
  const holder = document.getElementById('nav-spotify');
  if (!holder || !window.HD_SETTINGS) return;
  const raw = HD_SETTINGS.getSettings().spotifyUrl;
  const embedUrl = HD_SETTINGS.spotifyEmbedUrl(raw);
  holder.innerHTML = embedUrl
    ? `<iframe src="${embedUrl}" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`
    : '<p class="nav-spotify-hint">🎵 Add a Spotify link in Settings</p>';
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
  } else if (tabId === 'tasks' && window.HD_TASKS) {
    window.HD_TASKS.renderTasksTab(main);
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

window.HD_APP = { updateSpotifyEmbed };

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  if (window.HD_SETTINGS) window.HD_SETTINGS.applyAppearance();
  renderNav();
  route();
  if (window.HD_SCREENSAVER) window.HD_SCREENSAVER.initScreensaver();
  if (window.HD_STATS) window.HD_STATS.initStatsSwipe();
  if (window.HD_DAILY_STATUS) window.HD_DAILY_STATUS.initDailyStatusCheck();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
