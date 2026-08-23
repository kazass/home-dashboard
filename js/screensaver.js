const DEFAULT_IDLE_TIMEOUT_MS = 3 * 60 * 1000; // fallback if settings aren't available
const PHOTO_CYCLE_MS = 8000;

let lastActivity = Date.now();

function getIdleTimeoutMs() {
  if (window.HD_SETTINGS) return HD_SETTINGS.getIdleTimeoutMinutes() * 60 * 1000;
  return DEFAULT_IDLE_TIMEOUT_MS;
}

function isAmbientShowing() {
  return !!document.getElementById('ambient-overlay');
}

function markActivity() {
  lastActivity = Date.now();
}

function formatClock(date) {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatAmbientDate(date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function buildWeatherLine() {
  if (!window.HD_WEATHER) return '';
  const loc = HD_WEATHER.getCachedLocation();
  if (!loc) return ''; // never prompt for location from the screensaver
  try {
    const data = await HD_WEATHER.fetchWeather(loc.lat, loc.lon);
    const cur = data.current;
    return `${Math.round(cur.temperature_2m)}°C — ${HD_WEATHER.weatherCodeText(cur.weather_code)}`;
  } catch {
    return '';
  }
}

async function showAmbientOverlay() {
  if (isAmbientShowing()) return;
  const photos = window.HD_DB ? await HD_DB.dbGetAll('photos').catch(() => []) : [];
  if (isAmbientShowing()) return; // re-check: something may have shown it during the await above

  const overlay = document.createElement('div');
  overlay.id = 'ambient-overlay';
  overlay.innerHTML = `
    <div class="ambient-photo-bg" id="ambient-photo-bg"></div>
    <div class="ambient-scrim"></div>
    <div class="ambient-content">
      <div class="ambient-clock" id="ambient-clock"></div>
      <div class="ambient-date" id="ambient-date"></div>
      <div class="ambient-weather" id="ambient-weather"></div>
    </div>`;
  document.body.appendChild(overlay);

  let clockIntervalId = null;
  let photoIntervalId = null;
  let currentPhotoUrl = null;
  let photoIndex = 0;

  function setPhoto(index) {
    const bg = overlay.querySelector('#ambient-photo-bg');
    if (!bg || photos.length === 0) return;
    if (currentPhotoUrl) URL.revokeObjectURL(currentPhotoUrl);
    currentPhotoUrl = URL.createObjectURL(photos[index].photoBlob);
    bg.style.backgroundImage = `url(${currentPhotoUrl})`;
  }

  function cleanup() {
    clearInterval(clockIntervalId);
    if (photoIntervalId) clearInterval(photoIntervalId);
    if (currentPhotoUrl) URL.revokeObjectURL(currentPhotoUrl);
  }

  function tick() {
    if (!overlay.isConnected) {
      // Overlay was removed by something other than dismiss() below — self-heal
      // instead of leaking intervals or an object URL.
      cleanup();
      return;
    }
    const now = new Date();
    overlay.querySelector('#ambient-clock').textContent = formatClock(now);
    overlay.querySelector('#ambient-date').textContent = formatAmbientDate(now);
  }
  tick();
  clockIntervalId = setInterval(tick, 1000);

  if (photos.length) {
    setPhoto(0);
    if (photos.length > 1) {
      photoIntervalId = setInterval(() => {
        if (!overlay.isConnected) { clearInterval(photoIntervalId); return; }
        photoIndex = (photoIndex + 1) % photos.length;
        setPhoto(photoIndex);
      }, PHOTO_CYCLE_MS);
    }
  }

  buildWeatherLine().then((line) => {
    const el = document.getElementById('ambient-weather');
    if (el) el.textContent = line;
  });

  function dismiss() {
    cleanup();
    overlay.remove();
    markActivity();
  }

  overlay.addEventListener('click', dismiss, { once: true });
  overlay.addEventListener('touchstart', dismiss, { once: true });
}

function checkIdle() {
  if (isAmbientShowing()) return;
  if (Date.now() - lastActivity >= getIdleTimeoutMs()) {
    showAmbientOverlay();
  }
}

function initScreensaver() {
  ['mousedown', 'touchstart', 'keydown', 'click'].forEach((type) => {
    document.addEventListener(type, () => {
      if (!isAmbientShowing()) markActivity();
    }, { passive: true });
  });
  setInterval(checkIdle, 10000);
}

window.HD_SCREENSAVER = {
  initScreensaver,
  showAmbientOverlay,
  checkIdle,
  getIdleTimeoutMs,
  _setLastActivityForTest: (t) => { lastActivity = t; },
};
