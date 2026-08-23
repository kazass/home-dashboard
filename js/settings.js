const SETTINGS_KEY = 'hd-settings';
const DEFAULT_SETTINGS = { idleTimeoutMinutes: 3 };
const IDLE_TIMEOUT_OPTIONS = [1, 2, 3, 5, 10, 15, 30];

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

function openSettingsModal() {
  let overlay = document.getElementById('settings-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'settings-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  const current = getIdleTimeoutMinutes();
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
      </div>
    </div>`;

  overlay.querySelector('#settings-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#idle-timeout-select').addEventListener('change', (e) => {
    saveSettings({ idleTimeoutMinutes: Number(e.target.value) });
  });
}

window.HD_SETTINGS = { getSettings, saveSettings, getIdleTimeoutMinutes, openSettingsModal };
