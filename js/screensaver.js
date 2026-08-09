const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes of no touch/click/key activity

let lastActivity = Date.now();

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

function showAmbientOverlay() {
  if (isAmbientShowing()) return;

  const overlay = document.createElement('div');
  overlay.id = 'ambient-overlay';
  overlay.innerHTML = `
    <div class="ambient-clock" id="ambient-clock"></div>
    <div class="ambient-date" id="ambient-date"></div>
    <div class="ambient-weather" id="ambient-weather"></div>`;
  document.body.appendChild(overlay);

  let clockIntervalId = null;

  function tick() {
    if (!overlay.isConnected) {
      // Overlay was removed by something other than dismiss() below — self-heal
      // instead of leaking a forever-running interval.
      clearInterval(clockIntervalId);
      return;
    }
    const now = new Date();
    overlay.querySelector('#ambient-clock').textContent = formatClock(now);
    overlay.querySelector('#ambient-date').textContent = formatAmbientDate(now);
  }
  tick();
  clockIntervalId = setInterval(tick, 1000);

  buildWeatherLine().then((line) => {
    const el = document.getElementById('ambient-weather');
    if (el) el.textContent = line;
  });

  function dismiss() {
    clearInterval(clockIntervalId);
    overlay.remove();
    markActivity();
  }

  overlay.addEventListener('click', dismiss, { once: true });
  overlay.addEventListener('touchstart', dismiss, { once: true });
}

function checkIdle() {
  if (isAmbientShowing()) return;
  if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
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
  IDLE_TIMEOUT_MS,
  _setLastActivityForTest: (t) => { lastActivity = t; },
};
