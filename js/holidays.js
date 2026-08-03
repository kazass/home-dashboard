const HOLIDAY_COUNTRY = 'LT';

function holidayCacheKey(year) {
  return `hd-holidays-${HOLIDAY_COUNTRY}-${year}`;
}

async function getHolidays(year) {
  const key = holidayCacheKey(year);
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      /* fall through to refetch */
    }
  }
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${HOLIDAY_COUNTRY}`);
  if (!res.ok) throw new Error('Holiday fetch failed: ' + res.status);
  const data = await res.json();
  const simplified = data.map((h) => ({ date: h.date, name: h.localName || h.name }));
  localStorage.setItem(key, JSON.stringify(simplified));
  return simplified;
}

window.HD_HOLIDAYS = { getHolidays };
