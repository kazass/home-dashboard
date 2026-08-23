function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataUrl) {
  const res = await fetch(dataUrl);
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

async function buildBackupData() {
  const data = { version: 1, exportedAt: new Date().toISOString(), stores: {} };
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
  if (!data || !data.stores) throw new Error('This file doesn\'t look like a home-dashboard backup.');
  for (const store of HD_DB.STORES) {
    await HD_DB.dbClear(store);
    const records = data.stores[store] || [];
    for (const record of records) {
      await HD_DB.dbPut(store, await deserializeRecord(record));
    }
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
        <p class="text-muted">Everything lives only on this tablet's browser storage. Export a backup file now and then so a tablet reset can't wipe your data.</p>
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

window.HD_BACKUP = { openBackupModal, exportBackup, importBackup, buildBackupData, buildIcs, exportIcs };
