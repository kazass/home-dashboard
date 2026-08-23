const SETTINGS_KEY = 'hd-settings';
const DEFAULT_SETTINGS = { idleTimeoutMinutes: 3, showCompletedOnCalendar: false, accentColor: null };
const IDLE_TIMEOUT_OPTIONS = [1, 2, 3, 5, 10, 15, 30];
const ACCENT_PRESETS = [
  { color: '#2f6f4f', text: '#ffffff', name: 'Green (default)' },
  { color: '#4f7fc7', text: '#ffffff', name: 'Blue' },
  { color: '#c74f5c', text: '#ffffff', name: 'Red' },
  { color: '#b0762f', text: '#ffffff', name: 'Amber' },
  { color: '#a44fb0', text: '#ffffff', name: 'Purple' },
  { color: '#3f9e8f', text: '#ffffff', name: 'Teal' },
];

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

function applyAccentColor() {
  const { accentColor } = getSettings();
  const preset = ACCENT_PRESETS.find((p) => p.color === accentColor);
  const root = document.documentElement.style;
  if (preset) {
    root.setProperty('--accent', preset.color);
    root.setProperty('--accent-text', preset.text);
  } else {
    root.removeProperty('--accent');
    root.removeProperty('--accent-text');
  }
}

function openSettingsModal() {
  let overlay = document.getElementById('settings-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'settings-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  const current = getIdleTimeoutMinutes();
  const currentAccent = getSettings().accentColor;
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
          Accent color
          <div class="accent-swatches">
            ${ACCENT_PRESETS.map((p) => `<button type="button" class="accent-swatch ${p.color === currentAccent ? 'selected' : ''}" data-accent="${p.color}" style="background:${p.color}" title="${p.name}"></button>`).join('')}
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
  overlay.querySelectorAll('[data-accent]').forEach((btn) => {
    btn.addEventListener('click', () => {
      saveSettings({ accentColor: btn.dataset.accent });
      applyAccentColor();
      overlay.querySelectorAll('[data-accent]').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });
}

window.HD_SETTINGS = {
  getSettings, saveSettings, getIdleTimeoutMinutes, getShowCompletedOnCalendar,
  applyAccentColor, openSettingsModal, ACCENT_PRESETS,
};
