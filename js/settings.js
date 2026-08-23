const SETTINGS_KEY = 'hd-settings';
const DEFAULT_SETTINGS = { idleTimeoutMinutes: 3, showCompletedOnCalendar: false, theme: 'forest', accentColor: null };
const IDLE_TIMEOUT_OPTIONS = [1, 2, 3, 5, 10, 15, 30];

const ACCENT_PRESETS = [
  { color: '#2f6f4f', text: '#ffffff', name: 'Green' },
  { color: '#4f7fc7', text: '#ffffff', name: 'Blue' },
  { color: '#c74f5c', text: '#ffffff', name: 'Red' },
  { color: '#b0762f', text: '#ffffff', name: 'Amber' },
  { color: '#a44fb0', text: '#ffffff', name: 'Purple' },
  { color: '#3f9e8f', text: '#ffffff', name: 'Teal' },
];

// Each theme supplies both a light and dark variable set; type-event/holiday
// stay consistent across themes so calendar categories stay recognizable
// regardless of theme — only the decorative palette + accent shift. Accent
// color (below) can still override a theme's own accent on top of this.
const THEMES = {
  forest: {
    name: 'Forest', swatch: '#2f6f4f',
    light: { '--bg': '#f5f4f0', '--surface': '#ffffff', '--text': '#1f2321', '--text-muted': '#5b6660', '--accent': '#2f6f4f', '--accent-text': '#ffffff', '--border': '#e0ded8', '--today-bg': 'rgba(47, 111, 79, 0.12)', '--type-recurring': '#3f9e8f' },
    dark: { '--bg': '#16181a', '--surface': '#1f2224', '--text': '#eceeec', '--text-muted': '#9aa39d', '--accent': '#4fa877', '--accent-text': '#0c130f', '--border': '#2c302d', '--today-bg': 'rgba(79, 168, 119, 0.15)', '--type-recurring': '#3f9e8f' },
  },
  ocean: {
    name: 'Ocean', swatch: '#1f7a9e',
    light: { '--bg': '#f0f5f7', '--surface': '#ffffff', '--text': '#16232b', '--text-muted': '#587381', '--accent': '#1f7a9e', '--accent-text': '#ffffff', '--border': '#d7e6ec', '--today-bg': 'rgba(31, 122, 158, 0.12)', '--type-recurring': '#2fa6a6' },
    dark: { '--bg': '#0d181d', '--surface': '#142229', '--text': '#e7f1f5', '--text-muted': '#8fa9b3', '--accent': '#3fa8d1', '--accent-text': '#06171d', '--border': '#1e343d', '--today-bg': 'rgba(63, 168, 209, 0.15)', '--type-recurring': '#2fa6a6' },
  },
  sunset: {
    name: 'Sunset', swatch: '#d9752e',
    light: { '--bg': '#fbf3ec', '--surface': '#ffffff', '--text': '#2b1c14', '--text-muted': '#7a5d4d', '--accent': '#d9752e', '--accent-text': '#ffffff', '--border': '#f0ddc9', '--today-bg': 'rgba(217, 117, 46, 0.14)', '--type-recurring': '#c9605a' },
    dark: { '--bg': '#1c1310', '--surface': '#251a15', '--text': '#f5e9df', '--text-muted': '#b89c8a', '--accent': '#e08a45', '--accent-text': '#1c1310', '--border': '#3a2a20', '--today-bg': 'rgba(224, 138, 69, 0.15)', '--type-recurring': '#c9605a' },
  },
  lavender: {
    name: 'Lavender', swatch: '#7c5cbf',
    light: { '--bg': '#f6f2fa', '--surface': '#ffffff', '--text': '#241c30', '--text-muted': '#6f6280', '--accent': '#7c5cbf', '--accent-text': '#ffffff', '--border': '#e5daf2', '--today-bg': 'rgba(124, 92, 191, 0.12)', '--type-recurring': '#9a5cbf' },
    dark: { '--bg': '#16121e', '--surface': '#201a2b', '--text': '#ede8f5', '--text-muted': '#a599b8', '--accent': '#9b7fd4', '--accent-text': '#140f1c', '--border': '#332943', '--today-bg': 'rgba(155, 127, 212, 0.15)', '--type-recurring': '#9a5cbf' },
  },
  slate: {
    name: 'Slate', swatch: '#3a5568',
    light: { '--bg': '#f2f3f5', '--surface': '#ffffff', '--text': '#1a1d21', '--text-muted': '#5c6570', '--accent': '#3a5568', '--accent-text': '#ffffff', '--border': '#dde1e6', '--today-bg': 'rgba(58, 85, 104, 0.12)', '--type-recurring': '#4d8f8f' },
    dark: { '--bg': '#121417', '--surface': '#1b1e22', '--text': '#e9ebee', '--text-muted': '#99a2ab', '--accent': '#6f95ab', '--accent-text': '#0d1013', '--border': '#2a2e34', '--today-bg': 'rgba(111, 149, 171, 0.15)', '--type-recurring': '#4d8f8f' },
  },
};

function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(patch) {
  const merged = { ...getSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

function getIdleTimeoutMinutes() {
  return getSettings().idleTimeoutMinutes;
}

function getShowCompletedOnCalendar() {
  return getSettings().showCompletedOnCalendar;
}

// Applies the chosen theme's full palette, then re-applies any manual accent
// override on top of it (accent picker wins over the theme's own accent).
function applyAppearance() {
  const settings = getSettings();
  const theme = THEMES[settings.theme] || THEMES.forest;
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const vars = isDark ? theme.dark : theme.light;
  const root = document.documentElement.style;
  for (const [key, value] of Object.entries(vars)) root.setProperty(key, value);

  const preset = ACCENT_PRESETS.find((p) => p.color === settings.accentColor);
  if (preset) {
    root.setProperty('--accent', preset.color);
    root.setProperty('--accent-text', preset.text);
  }
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance);
}

function openSettingsModal() {
  let overlay = document.getElementById('settings-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'settings-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  const current = getIdleTimeoutMinutes();
  const { theme: currentTheme, accentColor: currentAccent } = getSettings();
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Settings</h3>
        <button class="modal-close" id="settings-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <label class="settings-field">
          Screensaver idle timeout
          <select id="idle-timeout-select">
            ${IDLE_TIMEOUT_OPTIONS.map((m) => `<option value="${m}" ${m === current ? 'selected' : ''}>${m} minute${m === 1 ? '' : 's'}</option>`).join('')}
          </select>
        </label>
        <p class="text-muted">How long the tablet sits untouched before the clock/weather screensaver takes over.</p>

        <label class="settings-field settings-checkbox">
          <input type="checkbox" id="show-completed-checkbox" ${getShowCompletedOnCalendar() ? 'checked' : ''}>
          Show completed items on the calendar grid
        </label>
        <p class="text-muted">Finished tasks/chores always show if you tap into a day — this only controls whether their checkmark chips also clutter the month/week view.</p>

        <div class="settings-field">
          Theme
          <div class="theme-swatches">
            ${Object.entries(THEMES).map(([key, t]) => `
              <button type="button" class="theme-swatch ${key === currentTheme ? 'selected' : ''}" data-theme="${key}" style="background:${t.swatch}">
                <span>${t.name}</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="settings-field">
          Accent color <span class="text-muted">(overrides the theme's own accent)</span>
          <div class="accent-swatches">
            ${ACCENT_PRESETS.map((p) => `<button type="button" class="accent-swatch ${p.color === currentAccent ? 'selected' : ''}" data-accent="${p.color}" style="background:${p.color}" title="${p.name}"></button>`).join('')}
            <button type="button" class="accent-swatch accent-swatch-reset ${!currentAccent ? 'selected' : ''}" data-accent="" title="Use theme's accent">↺</button>
          </div>
        </div>
      </div>
    </div>`;

  overlay.querySelector('#settings-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#idle-timeout-select').addEventListener('change', (e) => {
    saveSettings({ idleTimeoutMinutes: Number(e.target.value) });
  });
  overlay.querySelector('#show-completed-checkbox').addEventListener('change', (e) => {
    saveSettings({ showCompletedOnCalendar: e.target.checked });
  });
  overlay.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      saveSettings({ theme: btn.dataset.theme });
      applyAppearance();
      overlay.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });
  overlay.querySelectorAll('[data-accent]').forEach((btn) => {
    btn.addEventListener('click', () => {
      saveSettings({ accentColor: btn.dataset.accent || null });
      applyAppearance();
      overlay.querySelectorAll('[data-accent]').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });
}

window.HD_SETTINGS = {
  getSettings, saveSettings, getIdleTimeoutMinutes, getShowCompletedOnCalendar,
  applyAppearance, openSettingsModal, THEMES, ACCENT_PRESETS,
};
