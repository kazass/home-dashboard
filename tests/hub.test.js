const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
async function app(){
 const values=new Map();
 const c=vm.createContext({indexedDB:new IDBFactory(),structuredClone,crypto,Date,console,Blob,URL,fetch,setTimeout,clearTimeout});c.window=c;
 c.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 c.HD_CAL={ymd:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,parseYMD:s=>new Date(s+'T00:00:00')};
 for(const f of ['db','backup','week','sales'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),c);
 await c.HD_DB.dbReady;return c;
}
test('version 2 backup imports into 3.5; version 3 requires the sales store',async()=>{
 const c=await app();
 const stores=Object.fromEntries(Array.from(c.HD_DB.STORES).filter(s=>s!=='sales').map(s=>[s,[]]));
 stores.notes=[{id:'n',text:'Old household note'}];
 await c.HD_BACKUP.importBackup({text:async()=>JSON.stringify({version:2,stores})});
 assert.equal((await c.HD_DB.dbGet('notes','n')).text,'Old household note');
 assert.equal((await c.HD_DB.dbGetAll('sales')).length,0);
 await assert.rejects(c.HD_BACKUP.importBackup({text:async()=>JSON.stringify({version:3,stores})}),/sales.*missing/);
 assert.equal((await c.HD_DB.dbGetAll('notes')).length,1);
});
test('sales and appearance survive a 3.5 backup round trip',async()=>{
 const c=await app(),sale={id:'book-1',title:'Book',status:'pack',location:'B2',shipBy:'2026-09-10'};
 await c.HD_DB.dbPut('sales',sale);c.localStorage.setItem('hd-settings',JSON.stringify({theme:'cobalt',hubTiles:['sales','kitchen']}));
 const backup=await c.HD_BACKUP.buildBackupData();assert.equal(backup.version,3);
 await c.HD_DB.dbClear('sales');await c.HD_BACKUP.importBackup({text:async()=>JSON.stringify(backup)});
 assert.deepEqual(await c.HD_DB.dbGet('sales','book-1'),sale);
 assert.equal(JSON.parse(c.localStorage.getItem('hd-settings')).hubTiles[0],'sales');
});
test('ingredient review uses selected week and flags exact existing lines',async()=>{
 const c=await app();
 const result=c.HD_WEEK.ingredientsForRange({mealPlans:[{date:'2026-09-08',recipeId:'a'},{date:'2026-09-09',recipeId:'a'},{date:'2026-10-01',recipeId:'b'}],recipes:[{id:'a',ingredients:'Tomatoes\n  PASTA  \ntomatoes\n2 eggs'},{id:'b',ingredients:'Apples'}],shoppingItems:[{item:' pasta ',checked:false}]},'2026-09-07','2026-09-13');
 assert.equal(result.length,3);assert.equal(result.find(r=>r.line==='PASTA').alreadyAdded,true);assert.ok(!result.some(r=>r.line==='Apples'));
});
test('concurrent ingredient additions merge against current shopping records',async()=>{
 const c=await app();await c.HD_DB.dbPut('shoppingItems',{id:'old',item:'Tomatoes',checked:false});
 const counts=await Promise.all([c.HD_WEEK.addIngredients(['tomatoes','Pasta','2 eggs']),c.HD_WEEK.addIngredients([' PASTA ','2 eggs'])]);
 assert.equal(counts.reduce((a,b)=>a+b,0),2);assert.equal((await c.HD_DB.dbGetAll('shoppingItems')).length,3);
});
test('parcel status updates preserve shelf data and reject invalid transitions',async()=>{
 const c=await app();await c.HD_DB.dbPut('sales',{id:'one',title:'Book',location:'B2',status:'pack'});
 await c.HD_SALES.setStatus('one','sent');const sale=await c.HD_DB.dbGet('sales','one');
 assert.equal(sale.status,'sent');assert.equal(sale.location,'B2');
 await assert.rejects(c.HD_SALES.setStatus('one','invalid'),/valid status/);
 await assert.rejects(c.HD_SALES.setStatus('missing','sent'),/no longer exists/);
 assert.throws(()=>c.HD_SALES.validate({title:'Book',status:'pack',shipBy:'2026-02-31'}),/valid dispatch date/);
});

test('schema upgrade adds sales while retaining v3 records',async()=>{
 const factory=new IDBFactory();
 const old=await new Promise((resolve,reject)=>{const req=factory.open('home-dashboard',4);req.onupgradeneeded=()=>req.result.createObjectStore('notes',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 await new Promise(resolve=>{const tx=old.transaction('notes','readwrite');tx.objectStore('notes').put({id:'kept',text:'Existing v3 note'});tx.oncomplete=resolve;});old.close();
 const c=vm.createContext({indexedDB:factory});c.window=c;vm.runInContext(fs.readFileSync('js/db.js','utf8'),c);
 await c.HD_DB.dbReady;assert.equal((await c.HD_DB.dbGet('notes','kept')).text,'Existing v3 note');assert.equal((await c.HD_DB.dbGetAll('sales')).length,0);
});
