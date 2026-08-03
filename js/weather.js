const LOCATION_CACHE_KEY = 'hd-location-cache';

function getCachedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedLocation(lat, lon) {
  localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat, lon, savedAt: Date.now() }));
}

function getLocation() {
  return new Promise((resolve, reject) => {
    const cached = getCachedLocation();
    if (cached) {
      resolve(cached);
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCachedLocation(loc.lat, loc.lon);
        resolve(loc);
      },
      (err) => reject(err),
      { timeout: 10000 }
    );
  });
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed: ' + res.status);
  return res.json();
}

const WEATHER_CODE_TEXT = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow',
  75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers',
  82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ heavy hail',
};

function weatherCodeText(code) {
  return WEATHER_CODE_TEXT[code] || 'Weather unknown';
}

window.HD_WEATHER = { getLocation, fetchWeather, weatherCodeText, getCachedLocation, setCachedLocation };
