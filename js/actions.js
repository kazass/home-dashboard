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
      return HD_ACTION_CORE.transform(record, logs, {store,id,action,value,date:dateKey(),now:midnight(),names:HD_SETTINGS.getUserNames(),due:nextDue(store,record)});
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
