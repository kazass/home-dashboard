/* Shared, transactional household actions. Views never own completion totals. */
(() => {
  const dateKey = () => HD_CAL.ymd(new Date());
  const midnight = () => HD_CAL.parseYMD(dateKey()).getTime();
  const copy = (value) => structuredClone(value);
  function nextDue(store, record) {
    if (record.postponedUntil) return record.postponedUntil;
    if (store === 'homeWork') return record.dueDate || '';
    if (store === 'plants') return HD_CAL.ymd(HD_GARDEN.plantNextWaterDue(record));
    return HD_CAL.ymd(HD_SCHEDULING.choreNextDue(record));
  }
  async function transaction(store, id, transform) {
    const db = await HD_DB.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction([store, 'completions'], 'readwrite');
      const itemReq = tx.objectStore(store).get(id);
      const logsReq = tx.objectStore('completions').getAll();
      let itemReady = false, logsReady = false, result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('The change could not be saved.'));
      tx.onerror = () => reject(tx.error);
      const apply = () => {
        if (!itemReady || !logsReady) return;
        try {
          if (!itemReq.result) throw new Error('This item no longer exists.');
          result = transform(copy(itemReq.result), logsReq.result);
          if (!result) return;
          tx.objectStore(store).put(result.record);
          (result.removeLogs || []).forEach((key) => tx.objectStore('completions').delete(key));
          (result.putLogs || []).forEach((row) => tx.objectStore('completions').put(row));
        } catch (error) { reject(error); tx.abort(); }
      };
      itemReq.onsuccess = () => { itemReady = true; apply(); };
      logsReq.onsuccess = () => { logsReady = true; apply(); };
    });
  }
  async function change(store, id, action, value) {
    if (!['homeWork', 'scheduling', 'plants', 'shoppingItems'].includes(store)) throw new Error('Unsupported item.');
    const result = await transaction(store, id, (record, logs) => {
      const before = copy(record), putLogs = [], removeLogs = [];
      if (action === 'postpone') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Choose a date.');
        record.postponedUntil = value;
        if (store === 'homeWork') record.dueDate = value;
      } else if (action === 'assign') {
        if (!HD_SETTINGS.getAssigneeOptions().includes(value)) throw new Error('Choose a household member.');
        record.assignedTo = value;
      } else if (action === 'check' && store === 'shoppingItems') {
        record.checked = Boolean(value);
      } else if (action === 'complete') {
        const today = dateKey(), now = midnight();
        const type = store === 'homeWork' ? 'homework' : store === 'plants' ? 'plant' : 'chore';
        if (store === 'homeWork' && record.status === 'done') return null;
        if (store === 'plants' && record.lastWateredAt === now) return null;
        if (store === 'scheduling' && (record.lastDoneAt === now || logs.some(l => l.itemType === 'chore' && l.itemId === id && l.date === today))) return null;
        const due = nextDue(store, record), person = record.assignedTo || 'Both';
        record.postponedUntil = null;
        if (store === 'plants') record.lastWateredAt = now;
        else {
          record.currentStreak = !due || today <= due ? (record.currentStreak || 0) + 1 : 1;
          if (store === 'homeWork') { record.status = 'done'; record.completedAt = now; }
          else {
            record.lastDoneAt = now;
            record.completedCount = (record.completedCount || 0) + 1;
            if (record.rotate) {
              const names = HD_SETTINGS.getUserNames(), index = names.indexOf(person);
              if (index >= 0) record.assignedTo = names[(index + 1) % names.length];
            }
          }
        }
        const logId = type === 'homework' ? `homework:${id}` : `${type}:${id}:${today}`;
        putLogs.push({id: logId, itemType: type, itemId: id, person, date: today, createdAt: Date.now(), points: type === 'plant' || !HD_SETTINGS.getUserNames().includes(person) ? 0 : (record.points ?? 1) + HD_POINTS.streakBonus(record.currentStreak)});
      } else if (action === 'reopen' && store === 'homeWork') {
        record.status = 'todo'; record.completedAt = null; record.currentStreak = 0;
        logs.filter(l => l.itemType === 'homework' && l.itemId === id).forEach(l => removeLogs.push(l.id));
      } else throw new Error('Unsupported action.');
      const changed = Object.keys(record).filter(key => JSON.stringify(record[key]) !== JSON.stringify(before[key]));
      record.updatedAt = Math.max(Date.now(), (Number(before.updatedAt) || 0) + 1);
      changed.push('updatedAt');
      const logIds = new Set([...removeLogs, ...putLogs.map(l => l.id)]);
      return {record, putLogs, removeLogs, undo: {store, id, before, after: copy(record), changed, logIds: [...logIds], oldLogs: logs.filter(l => logIds.has(l.id))}};
    });
    return result?.undo || null;
  }
  async function undo(change) {
    if (!change) return;
    await transaction(change.store, change.id, record => {
      if (change.changed.some(key => JSON.stringify(record[key]) !== JSON.stringify(change.after[key]))) throw new Error('This item changed again. Open it to make another change.');
      change.changed.forEach(key => {
        if (key in change.before) record[key] = change.before[key];
        else delete record[key];
      });
      return {record, removeLogs: change.logIds, putLogs: change.oldLogs};
    });
  }
  window.HD_ACTIONS = {change, undo, nextDue};
})();
