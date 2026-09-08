/* One completion policy for tablet, cloud and ChatGPT actions. */
(() => {
const copy=value=>structuredClone(value);
function transform(record,logs,{store,id,action,value,date,now,names,due}) {
      const before = copy(record), putLogs = [], removeLogs = [];
      if (action === 'postpone') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Choose a date.');
        record.postponedUntil = value;
        if (store === 'homeWork') record.dueDate = value;
      } else if (action === 'assign') {
        if (!['Both', ...names].includes(value)) throw new Error('Choose a household member.');
        record.assignedTo = value;
      } else if (action === 'check' && store === 'shoppingItems') {
        record.checked = Boolean(value);
      } else if (action === 'complete') {
        const today = date;
        const type = store === 'homeWork' ? 'homework' : store === 'plants' ? 'plant' : 'chore';
        if (store === 'homeWork' && record.status === 'done') return null;
        if (store === 'plants' && record.lastWateredAt === now) return null;
        if (store === 'scheduling' && (record.lastDoneAt === now || logs.some(l => l.itemType === 'chore' && l.itemId === id && l.date === today))) return null;
        const person = record.assignedTo || 'Both';
        record.postponedUntil = null;
        if (store === 'plants') record.lastWateredAt = now;
        else {
          record.currentStreak = !due || today <= due ? (record.currentStreak || 0) + 1 : 1;
          if (store === 'homeWork') { record.status = 'done'; record.completedAt = now; }
          else {
            record.lastDoneAt = now;
            record.completedCount = (record.completedCount || 0) + 1;
            if (record.rotate) {
              const index = names.indexOf(person);
              if (index >= 0) record.assignedTo = names[(index + 1) % names.length];
            }
          }
        }
        const logId = type === 'homework' ? `homework:${id}` : `${type}:${id}:${today}`;
        putLogs.push({id: logId, itemType: type, itemId: id, person, date: today, createdAt: Date.now(), points: type === 'plant' || !names.includes(person) ? 0 : (record.points ?? 1) + (record.currentStreak > 0 && record.currentStreak % 3 === 0 ? 1 : 0)});
      } else if (action === 'reopen' && store === 'homeWork') {
        record.status = 'todo'; record.completedAt = null; record.currentStreak = 0;
        logs.filter(l => l.itemType === 'homework' && l.itemId === id).forEach(l => removeLogs.push(l.id));
      } else throw new Error('Unsupported action.');
      const changed = Object.keys(record).filter(key => JSON.stringify(record[key]) !== JSON.stringify(before[key]));
      record.updatedAt = Math.max(Date.now(), (Number(before.updatedAt) || 0) + 1);
      changed.push('updatedAt');
      const logIds = new Set([...removeLogs, ...putLogs.map(l => l.id)]);
      return {record, putLogs, removeLogs, undo: {store, id, before, after: copy(record), changed, logIds: [...logIds], oldLogs: logs.filter(l => logIds.has(l.id))}};
}
globalThis.HD_ACTION_CORE={transform};
})();
