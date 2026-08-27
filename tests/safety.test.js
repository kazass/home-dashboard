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
