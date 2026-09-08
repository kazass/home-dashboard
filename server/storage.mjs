export const STORES = ['events','notes','shoppingItems','homeWork','scheduling','maintenanceJobs','ideas','plants','recipes','mealPlans','photos','goals','completions','activities','sales','notifications','household'];
export const keyOf = (store,id) => `${store}/${id}`;
export function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
export function validateRecord(store,record) {
  if (!STORES.includes(store) || !record || typeof record!=='object' || Array.isArray(record) || !/^[A-Za-z0-9._:-]{1,200}$/.test(record.id||'')) fail('Invalid record.');
  const strings={events:['title','date'],notes:['text'],shoppingItems:['item'],homeWork:['title'],scheduling:['title'],ideas:['title'],plants:['name'],recipes:['title'],mealPlans:['date','recipeId'],goals:['title'],completions:['itemType','itemId','person'],activities:['name'],sales:['title','status'],notifications:['title','sourceId','source'],household:['timezone']};
  for(const field of strings[store]||[]) if(typeof record[field]!=='string') fail(`Invalid ${field}.`);
  if (store==='sales'&&!['listed','pack','ready','sent','complete'].includes(record.status)) fail('Invalid sale status.');
  if (store==='household') {
    try{new Intl.DateTimeFormat('en',{timeZone:record.timezone});}catch{fail('Invalid time zone.');}
    if(!Array.isArray(record.userNames)||record.userNames.length>20||record.userNames.some(x=>typeof x!=='string'||!x.trim()||x.length>80))fail('Invalid household names.');
  }
  const scan=value=>{
    if(!value||typeof value!=='object')return;
    if(value.__asset && !/^[a-f0-9]{64}$/.test(value.__asset))fail('Invalid photo reference.');
    for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))fail('Invalid record field.');scan(v);}
  };scan(record);
  if(JSON.stringify(record).length>100000)fail('This record is too large.');
}
export async function snapshot(db,owner) {
  // A D1 batch gives the revision and records one consistent read transaction.
  const [head,data]=await db.batch([
    db.prepare('SELECT revision FROM households WHERE owner = ?').bind(owner),
    db.prepare('SELECT store,id,value FROM records WHERE owner = ?').bind(owner),
  ]);
  return {revision:head.results[0]?.revision||0, records:Object.fromEntries(data.results.map(r=>[keyOf(r.store,r.id),JSON.parse(r.value)]))};
}
export async function commit(db,owner,revision,changes) {
  if(!Number.isSafeInteger(revision)||revision<0||!Array.isArray(changes)||changes.length>500)fail('Invalid change batch.');
  const seen=new Set();
  for(const c of changes){
    if(!STORES.includes(c.store)||!/^[A-Za-z0-9._:-]{1,200}$/.test(c.id||'')||seen.has(keyOf(c.store,c.id)))fail('Invalid change.');
    seen.add(keyOf(c.store,c.id));
    if(c.value!==null){validateRecord(c.store,c.value);if(c.value.id!==c.id)fail('Record ID mismatch.');}
  }
  if(!changes.length)return snapshot(db,owner);
  const operation=crypto.randomUUID();
  const gate='EXISTS (SELECT 1 FROM households WHERE owner = ? AND revision = ? AND operation = ?)';
  const queries=[
    db.prepare('INSERT OR IGNORE INTO households(owner,revision,operation,updated_at) VALUES (?,0,\'\',0)').bind(owner),
    db.prepare('UPDATE households SET revision = revision + 1, operation = ?, updated_at = ? WHERE owner = ? AND revision = ?').bind(operation,Date.now(),owner,revision),
  ];
  for(const c of changes)queries.push(c.value===null
    ? db.prepare(`DELETE FROM records WHERE owner = ? AND store = ? AND id = ? AND ${gate}`).bind(owner,c.store,c.id,owner,revision+1,operation)
    : db.prepare(`INSERT INTO records(owner,store,id,value) SELECT ?,?,?,? WHERE ${gate} ON CONFLICT(owner,store,id) DO UPDATE SET value=excluded.value`).bind(owner,c.store,c.id,JSON.stringify(c.value),owner,revision+1,operation));
  const results=await db.batch(queries);
  if(!results[1].meta.changes)fail('The household changed on another device. Please sync again.',409);
  // Return the accepted revision, not a later snapshot that could hide a concurrent edit.
  return {revision:revision+1};
}
