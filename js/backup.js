const BACKUP_VERSION = 2;
const BACKUP_PREFERENCE_KEYS = ['hd-settings', 'hd-layout'];

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Backup contains an invalid photo.');
  }
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error('Backup photo could not be decoded.');
  return res.blob();
}

async function serializeRecord(record) {
  const copy = { ...record };
  for (const key of Object.keys(copy)) {
    if (copy[key] instanceof Blob) {
      copy[key] = { __blob: true, dataUrl: await blobToDataURL(copy[key]) };
    }
  }
  return copy;
}

async function deserializeRecord(record) {
  const copy = { ...record };
  for (const key of Object.keys(copy)) {
    if (copy[key] && copy[key].__blob) {
      copy[key] = await dataURLToBlob(copy[key].dataUrl);
    }
  }
  return copy;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateBackupData(data) {
  if (!isPlainObject(data) || !isPlainObject(data.stores)) {
    throw new Error('This file does not look like a Home Dashboard backup.');
  }
  const version = Number(data.version || 1);
  if (!Number.isInteger(version) || version < 1 || version > BACKUP_VERSION) {
    throw new Error(`Backup version ${data.version} is not supported by this app.`);
  }

  for (const store of HD_DB.STORES) {
    const records = data.stores[store] || [];
    if (!Array.isArray(records)) throw new Error(`Backup store "${store}" is invalid.`);
    const ids = new Set();
    for (const record of records) {
      if (!isPlainObject(record) || typeof record.id !== 'string'
          || !/^[A-Za-z0-9._:-]{1,200}$/.test(record.id)) {
        throw new Error(`Backup store "${store}" contains an invalid record ID.`);
      }
      if (ids.has(record.id)) throw new Error(`Backup store "${store}" contains duplicate IDs.`);
      ids.add(record.id);
    }
  }

  if (data.preferences !== undefined) {
    if (!isPlainObject(data.preferences)) throw new Error('Backup preferences are invalid.');
    for (const key of BACKUP_PREFERENCE_KEYS) {
      const value = data.preferences[key];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new Error(`Backup preference "${key}" is invalid.`);
      }
      if (typeof value === 'string') {
        const parsed = JSON.parse(value);
        if (!isPlainObject(parsed)) throw new Error(`Backup preference "${key}" is invalid.`);
      }
    }
  }
  return version;
}

function validatePreparedRecords(recordsByStore) {
  const requiredStrings = {
    events: ['title', 'date'], notes: ['text'], shoppingItems: ['item'],
    homeWork: ['title'], scheduling: ['title'], ideas: ['title'], plants: ['name'],
    recipes: ['title'], mealPlans: ['date', 'recipeId'], goals: ['title'],
    completions: ['itemType', 'itemId', 'person'], activities: ['name'],
  };
  for (const [store, fields] of Object.entries(requiredStrings)) {
    for (const record of recordsByStore[store] || []) {
      for (const field of fields) {
        if (typeof record[field] !== 'string') {
          throw new Error(`Backup store "${store}" contains an invalid "${field}" field.`);
        }
      }
    }
  }

  for (const record of recordsByStore.photos || []) {
    if (!(record.photoBlob instanceof Blob)) throw new Error('Backup contains an invalid screensaver photo.');
  }
  for (const store of ['plants', 'recipes']) {
    for (const record of recordsByStore[store] || []) {
      if (record.photoBlob != null && !(record.photoBlob instanceof Blob)) {
        throw new Error(`Backup store "${store}" contains an invalid photo.`);
      }
    }
  }
}

function capturePreferences() {
  return Object.fromEntries(BACKUP_PREFERENCE_KEYS.map((key) => [key, localStorage.getItem(key)]));
}

function applyPreferences(preferences) {
  if (!preferences) return;
  for (const key of BACKUP_PREFERENCE_KEYS) {
    if (!(key in preferences)) continue;
    if (preferences[key] === null) localStorage.removeItem(key);
    else localStorage.setItem(key, preferences[key]);
  }
}

async function buildBackupData() {
  const data = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores: {},
    preferences: capturePreferences(),
  };
  for (const store of HD_DB.STORES) {
    const records = await HD_DB.dbGetAll(store);
    data.stores[store] = await Promise.all(records.map(serializeRecord));
  }
  return data;
}

async function exportBackup() {
  const data = await buildBackupData();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `home-dashboard-backup-${HD_CAL.ymd(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  validateBackupData(data);

  // Decode every record before touching current data. This catches malformed
  // photos and other import errors while the existing database is still safe.
  const prepared = {};
  for (const store of HD_DB.STORES) {
    const records = data.stores[store] || [];
    prepared[store] = await Promise.all(records.map(deserializeRecord));
  }
  validatePreparedRecords(prepared);

  const previousPreferences = capturePreferences();
  try {
    applyPreferences(data.preferences);
    await HD_DB.dbReplaceAll(prepared);
  } catch (err) {
    applyPreferences(previousPreferences);
    throw err;
  }
}

function icsEscape(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

// One-off calendar events only (recurring schedules/chores aren't included —
// they're computed on the fly, not stored as dated occurrences).
async function buildIcs() {
  const events = await HD_DB.dbGetAll('events');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Home Dashboard//EN'];
  for (const e of events) {
    const start = e.date.replace(/-/g, '');
    const endExclusive = HD_CAL.addDays(HD_CAL.parseYMD(e.endDate || e.date), 1);
    const end = HD_CAL.ymd(endExclusive).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@home-dashboard`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEscape(e.title)}`,
      `DESCRIPTION:${icsEscape(e.notes)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

async function exportIcs() {
  const ics = await buildIcs();
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `home-dashboard-calendar-${HD_CAL.ymd(new Date())}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openBackupModal() {
  let overlay = document.getElementById('backup-modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'backup-modal-overlay';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Backup</h3>
        <button class="modal-close" id="backup-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p class="text-muted">Everything lives only on this tablet's browser storage. Export a backup file now and then so a tablet reset can't wipe your data. Backups include app data, photos, settings, and dashboard layout.</p>
        <button type="button" id="export-backup-btn">Export backup file</button>
        <button type="button" id="export-ics-btn">Export calendar (.ics)</button>
        <p class="text-muted">One-way export of calendar events for importing into Google/Apple/Outlook calendar. Recurring chores/plans aren't included.</p>
        <hr>
        <p class="text-muted">Importing replaces <strong>all current data</strong> with what's in the file.</p>
        <input type="file" id="import-backup-input" accept="application/json">
        <p id="backup-status" class="text-muted"></p>
      </div>
    </div>`;

  overlay.querySelector('#backup-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#export-backup-btn').addEventListener('click', async () => {
    const status = overlay.querySelector('#backup-status');
    status.textContent = 'Exporting…';
    try {
      await exportBackup();
      status.textContent = 'Backup downloaded.';
    } catch (err) {
      status.textContent = 'Export failed: ' + err.message;
    }
  });

  overlay.querySelector('#export-ics-btn').addEventListener('click', async () => {
    const status = overlay.querySelector('#backup-status');
    status.textContent = 'Exporting…';
    try {
      await exportIcs();
      status.textContent = 'Calendar file downloaded.';
    } catch (err) {
      status.textContent = 'Export failed: ' + err.message;
    }
  });

  overlay.querySelector('#import-backup-input').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    if (!confirm('This will replace all current data with the contents of this backup file. Continue?')) {
      ev.target.value = '';
      return;
    }
    const status = overlay.querySelector('#backup-status');
    status.textContent = 'Importing…';
    try {
      await importBackup(file);
      status.textContent = 'Import complete. Reloading…';
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      status.textContent = 'Import failed: ' + err.message;
    }
  });
}

window.HD_BACKUP = {
  openBackupModal, exportBackup, importBackup, buildBackupData, buildIcs, exportIcs,
  validateBackupData, BACKUP_VERSION,
};
