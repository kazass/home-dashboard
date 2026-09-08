const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadScript(relativePath, globals = {}) {
  const context = vm.createContext({
    Blob, URL, crypto, console, fetch, setTimeout, clearTimeout,
    ...globals,
  });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), context, {
    filename: relativePath,
  });
  return context;
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('monthly recurrence clamps to the target month', () => {
  const context = loadScript('js/scheduling.js', {
    HD_CAL: {
      parseYMD: (value) => {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
    },
  });

  const normalYear = context.HD_SCHEDULING.addUnits(new Date(2026, 0, 31), 1, 'months');
  const leapYear = context.HD_SCHEDULING.addUnits(new Date(2028, 0, 31), 1, 'months');
  assert.equal(normalYear.getFullYear(), 2026);
  assert.equal(normalYear.getMonth(), 1);
  assert.equal(normalYear.getDate(), 28);
  assert.equal(leapYear.getMonth(), 1);
  assert.equal(leapYear.getDate(), 29);
});

test('user labels are escaped and external URLs reject active protocols', () => {
  const localStorage = memoryStorage({
    'hd-settings': JSON.stringify({
      userNames: ['<img src=x onerror=alert(1)>'],
      personColors: { '<img src=x onerror=alert(1)>': 'red;position:fixed' },
    }),
  });
  const context = loadScript('js/settings.js', {
    localStorage,
    HD_CAL: {
      escapeHtml: (value) => String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[char])),
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  });

  const badge = context.HD_SETTINGS.personBadgeHtml('<img src=x onerror=alert(1)>');
  assert.match(badge, /&lt;img/);
  assert.doesNotMatch(badge, /style=/);
  assert.equal(context.HD_SETTINGS.safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(context.HD_SETTINGS.safeExternalUrl('https://example.com/a').startsWith('https://'), true);
});

test('homework completions use a stable ID and legacy duplicates count once', async () => {
  const rows = new Map();
  const context = loadScript('js/points.js', {
    HD_CAL: { ymd: () => '2026-08-27' },
    HD_SETTINGS: { getUserNames: () => ['Kasparas', 'Izolda'] },
    HD_DB: {
      dbPut: async (_store, record) => rows.set(record.id, record),
      dbGet: async (_store, id) => rows.get(id),
      dbGetAll: async () => [...rows.values()],
      dbDelete: async (_store, id) => rows.delete(id),
    },
  });

  await context.HD_POINTS.logCompletion({
    itemType: 'homework', itemId: 'task-1', person: 'Kasparas', points: 2,
  });
  await context.HD_POINTS.logCompletion({
    itemType: 'homework', itemId: 'task-1', person: 'Kasparas', points: 2,
  });
  assert.equal(rows.size, 1);

  rows.set('legacy-1', {
    id: 'legacy-1', itemType: 'homework', itemId: 'task-2', person: 'Izolda',
    points: 3, date: '2026-08-26', createdAt: 1,
  });
  rows.set('legacy-2', {
    id: 'legacy-2', itemType: 'homework', itemId: 'task-2', person: 'Izolda',
    points: 3, date: '2026-08-26', createdAt: 2,
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(await context.HD_POINTS.getLeaderboard())),
    { Kasparas: 2, Izolda: 3 },
  );
});

test('backup validation finishes before the database is replaced', async () => {
  let replaceCalls = 0;
  const localStorage = memoryStorage({ 'hd-settings': '{"theme":"forest"}' });
  const context = loadScript('js/backup.js', {
    localStorage,
    HD_DB: {
      STORES: ['notes', 'photos'],
      dbReplaceAll: async () => { replaceCalls++; },
    },
  });

  const invalidFile = {
    text: async () => JSON.stringify({
      version: 2,
      stores: { notes: [{ id: 'bad id', text: 'unsafe' }], photos: [] },
    }),
  };
  await assert.rejects(context.HD_BACKUP.importBackup(invalidFile), /invalid record ID/);
  assert.equal(replaceCalls, 0);

  const validFile = {
    text: async () => JSON.stringify({
      version: 2,
      stores: { notes: [{ id: 'note-1', text: 'safe' }], photos: [] },
      preferences: { 'hd-settings': '{"theme":"ocean"}', 'hd-layout': null },
    }),
  };
  await context.HD_BACKUP.importBackup(validFile);
  assert.equal(replaceCalls, 1);
  assert.equal(localStorage.getItem('hd-settings'), '{"theme":"ocean"}');
});

test('backup restores previous preferences when database replacement fails', async () => {
  const localStorage = memoryStorage({ 'hd-settings': '{"theme":"forest"}' });
  const context = loadScript('js/backup.js', {
    localStorage,
    HD_DB: {
      STORES: ['notes'],
      dbReplaceAll: async () => { throw new Error('transaction failed'); },
    },
  });
  const file = {
    text: async () => JSON.stringify({
      version: 2,
      stores: { notes: [{ id: 'note-1', text: 'safe' }] },
      preferences: { 'hd-settings': '{"theme":"ocean"}' },
    }),
  };

  await assert.rejects(context.HD_BACKUP.importBackup(file), /transaction failed/);
  assert.equal(localStorage.getItem('hd-settings'), '{"theme":"forest"}');
});

test('empty, truncated, falsy-store and unsupported-version backups never replace data', async () => {
  let replacements = 0;
  const localStorage = memoryStorage({ 'hd-settings': '{"theme":"forest"}' });
  const context = loadScript('js/backup.js', {
    localStorage,
    HD_DB: { STORES: ['notes', 'photos'], dbReplaceAll: async () => { replacements++; } },
  });
  const invalid = [
    { version: 2, stores: {} },
    { version: 2, stores: { notes: [] } },
    { version: 1, stores: { unrelated: [] } },
    ...[null, false, 0, ''].map((value) => ({ version: 1, stores: { notes: value } })),
    ...[null, false, 0, '', '2', 5].map((version) => ({ version, stores: { notes: [], photos: [] } })),
    { version: 2, stores: { notes: [{ id: 'a', text: 'one' }, { id: 'a', text: 'two' }], photos: [] } },
    { version: 2, stores: { notes: [{ id: 'a', text: 123 }], photos: [] } },
    { version: 2, stores: { notes: [], photos: [{ id: 'p', photoBlob: { __blob: true, dataUrl: 'https://example.com' } }] } },
  ];
  for (const data of invalid) {
    await assert.rejects(context.HD_BACKUP.importBackup({ text: async () => JSON.stringify(data) }));
  }
  assert.equal(replacements, 0);
  assert.equal(localStorage.getItem('hd-settings'), '{"theme":"forest"}');
});

test('version 1 backups remain compatible and preserve existing preferences', async () => {
  let restored;
  const localStorage = memoryStorage({ 'hd-layout': '{"order":["weather"]}' });
  const context = loadScript('js/backup.js', {
    localStorage,
    HD_DB: { STORES: ['notes', 'photos'], dbReplaceAll: async (data) => { restored = data; } },
  });
  await context.HD_BACKUP.importBackup({ text: async () => JSON.stringify({
    version: 1, stores: { notes: [{ id: 'legacy', text: 'Keep this note' }] },
  }) });
  assert.equal(restored.notes[0].text, 'Keep this note');
  assert.equal(restored.photos.length, 0);
  assert.equal(localStorage.getItem('hd-layout'), '{"order":["weather"]}');
});

test('backup round-trip preserves records, photo bytes, settings and layout', async () => {
  class TestFileReader {
    async readAsDataURL(blob) {
      this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
      this.onload();
    }
  }
  const bytes = new Uint8Array([0, 1, 127, 128, 255]);
  let records = {
    notes: [{ id: 'n', text: 'Garden note', createdAt: 123 }],
    photos: [{ id: 'p', photoBlob: new Blob([bytes], { type: 'image/png' }) }],
  };
  const initialPreferences = { 'hd-settings': '{"theme":"forest"}', 'hd-layout': '{"order":["weather"]}' };
  const localStorage = memoryStorage(initialPreferences);
  const context = loadScript('js/backup.js', {
    localStorage, FileReader: TestFileReader,
    HD_DB: {
      STORES: Object.keys(records), dbGetAll: async (store) => records[store],
      dbReplaceAll: async (replacement) => { records = replacement; },
    },
  });
  const exported = JSON.stringify(await context.HD_BACKUP.buildBackupData());
  records = { notes: [], photos: [] };
  localStorage.setItem('hd-settings', '{"theme":"ocean"}');
  localStorage.removeItem('hd-layout');
  await context.HD_BACKUP.importBackup({ text: async () => exported });
  assert.deepEqual(JSON.parse(JSON.stringify(records.notes)), [{ id: 'n', text: 'Garden note', createdAt: 123 }]);
  assert.deepEqual(new Uint8Array(await records.photos[0].photoBlob.arrayBuffer()), bytes);
  assert.equal(records.photos[0].photoBlob.type, 'image/png');
  for (const [key, value] of Object.entries(initialPreferences)) assert.equal(localStorage.getItem(key), value);
});

test('undo clears all legacy homework credits and recompletion awards points once', async () => {
  const rows = new Map([
    ['old-a', { id: 'old-a', itemType: 'homework', itemId: 't', person: 'Test User', points: 2 }],
    ['old-b', { id: 'old-b', itemType: 'homework', itemId: 't', person: 'Test User', points: 2 }],
  ]);
  const context = loadScript('js/points.js', {
    HD_CAL: { ymd: () => '2026-09-07' },
    HD_SETTINGS: { getUserNames: () => ['Test User'] },
    HD_DB: {
      dbGetAll: async () => [...rows.values()], dbGet: async (_s, id) => rows.get(id),
      dbDelete: async (_s, id) => rows.delete(id), dbPut: async (_s, row) => rows.set(row.id, row),
    },
  });
  await context.HD_POINTS.deleteCompletionsForItem('homework', 't');
  assert.equal((await context.HD_POINTS.getLeaderboard())['Test User'], 0);
  const completion = { itemType: 'homework', itemId: 't', person: 'Test User', points: 2 };
  await context.HD_POINTS.logCompletion(completion);
  await context.HD_POINTS.logCompletion(completion);
  assert.equal((await context.HD_POINTS.getLeaderboard())['Test User'], 2);
  assert.equal(rows.size, 1);
});

test('synchronous restore write failure explicitly aborts the database transaction', async () => {
  let aborts = 0;
  let clears = 0;
  const tx = {
    addEventListener: () => {},
    objectStore: (name) => name === '_sync' ? {put:()=>{}} : ({
      clear: () => { clears++; },
      put: () => { throw new Error('DataCloneError'); },
    }),
    abort: () => { aborts++; },
  };
  const context = loadScript('js/db.js', {
    indexedDB: {
      open: () => {
        const req = { result: { transaction: () => tx } };
        queueMicrotask(() => req.onsuccess());
        return req;
      },
    },
  });
  await assert.rejects(context.HD_DB.dbReplaceAll({ notes: [{ id: 'bad', value: () => {} }] }), /DataCloneError/);
  assert.ok(clears > 0, 'restore had already queued destructive operations');
  assert.equal(aborts, 1, 'queued operations must be rolled back');
});
