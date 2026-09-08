const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
async function app(){
 const c=vm.createContext({indexedDB:new IDBFactory(),structuredClone,crypto,Date,console});c.window=c;
 c.HD_CAL={ymd:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,parseYMD:s=>new Date(s+'T00:00:00')};
 c.HD_SETTINGS={getAssigneeOptions:()=>['Both','Kasparas','Izolda'],getUserNames:()=>['Kasparas','Izolda']};
 for(const f of ['db','scheduling','points','action-core','actions'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),c);
 await c.HD_DB.dbReady;return c;
}
test('concurrent completion credits a task once and Undo restores it',async()=>{
 const c=await app(),db=c.HD_DB;await db.dbPut('homeWork',{id:'task',title:'Test',status:'todo',assignedTo:'Kasparas',points:2});
 const results=await Promise.all([c.HD_ACTIONS.change('homeWork','task','complete'),c.HD_ACTIONS.change('homeWork','task','complete')]);
 assert.equal(results.filter(Boolean).length,1);assert.equal((await db.dbGetAll('completions')).length,1);
 await c.HD_ACTIONS.undo(results.find(Boolean));assert.equal((await db.dbGet('homeWork','task')).status,'todo');assert.equal((await db.dbGetAll('completions')).length,0);
});
test('postpone and reassign are reversible, stale Undo cannot overwrite newer changes',async()=>{
 const c=await app(),db=c.HD_DB;await db.dbPut('homeWork',{id:'task',status:'todo',assignedTo:'Kasparas',dueDate:'2026-09-07'});
 const later=await c.HD_ACTIONS.change('homeWork','task','postpone','2026-09-08');
 const assign=await c.HD_ACTIONS.change('homeWork','task','assign','Izolda');
 await assert.rejects(c.HD_ACTIONS.undo(later),/changed again/);
 await c.HD_ACTIONS.undo(assign);assert.equal((await db.dbGet('homeWork','task')).assignedTo,'Kasparas');
 await c.HD_ACTIONS.undo(later);assert.equal((await db.dbGet('homeWork','task')).dueDate,'2026-09-07');
});
test('rotating chore keeps credit with the person who did it; Undo restores assignment',async()=>{
 const c=await app(),db=c.HD_DB;await db.dbPut('scheduling',{id:'chore',title:'Test',category:'chore',anchorDate:'2026-09-07',intervalCount:1,intervalUnit:'weeks',assignedTo:'Kasparas',rotate:true});
 const undo=await c.HD_ACTIONS.change('scheduling','chore','complete');
 assert.equal((await db.dbGet('scheduling','chore')).assignedTo,'Izolda');assert.equal((await db.dbGetAll('completions'))[0].person,'Kasparas');
 assert.equal(await c.HD_ACTIONS.change('scheduling','chore','complete'),null);
 await c.HD_ACTIONS.undo(undo);assert.equal((await db.dbGet('scheduling','chore')).assignedTo,'Kasparas');assert.equal((await db.dbGetAll('completions')).length,0);
});
