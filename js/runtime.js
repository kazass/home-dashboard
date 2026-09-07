/* The redesign has its own browser data. Original app records stay untouched. */
window.HD_DATABASE_NAME = 'home-dashboard-v3';
window.HD_STORAGE = {
  key: (key) => key.replace(/^hd-/, 'hd-v3-'),
  getItem(key) { return localStorage.getItem(this.key(key)); },
  setItem(key, value) { localStorage.setItem(this.key(key), value); },
  removeItem(key) { localStorage.removeItem(this.key(key)); },
};
// The internal HTTP preview lacks randomUUID; getRandomValues remains available.
if (!crypto.randomUUID) crypto.randomUUID = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
