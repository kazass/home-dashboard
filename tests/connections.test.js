const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite'),{IDBFactory}=require('fake-indexeddb');
function database(){
  const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('drizzle/0000_black_cyclops.sql','utf8'));
  return {prepare(sql){return {bind(...args){return {sql,args}}}},async batch(queries){
    db.exec('BEGIN');try{const result=queries.map(q=>{const statement=db.prepare(q.sql);if(statement.columns().length)return {results:statement.all(...q.args),meta:{changes:0}};return {results:[],meta:statement.run(...q.args)};});db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
  }};
}
async function harness(){
  const worker=(await import('../server/index.mjs')).default,DB=database(),assets=new Map();
  const env={DB,BUCKET:{async put(k,b,m){assets.set(k,{body:b,httpMetadata:m.httpMetadata})},async get(k){return assets.get(k)}}};
  async function request(path,options={},email='owner@example.test'){
    const headers=new Headers(options.headers);if(email)headers.set('oai-authenticated-user-email',email);
    return worker.fetch(new Request('https://household.test'+path,{...options,headers}),env);
  }
  return {DB,request,assets};
}
const post=data=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
async function device(request){
  let prefs={userNames:['Kasparas','Izolda']};
  const c=vm.createContext({indexedDB:new IDBFactory(),crypto,structuredClone,Blob,console,Date,Intl,fetch:request,navigator:{},setTimeout:()=>0,clearTimeout(){},setInterval(){},document:{querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}});c.window=c;c.addEventListener=()=>{};
  c.HD_CAL={escapeHtml:s=>String(s),ymd:d=>d.toISOString().slice(0,10),parseYMD:s=>new Date(s+'T00:00:00')};
  c.HD_SETTINGS={getUserNames:()=>prefs.userNames,getSettings:()=>prefs,saveSettings:p=>{prefs={...prefs,...p}}};
  c.localStorage={setItem:(k,v)=>{prefs=JSON.parse(v)}};c.HD_UI={refresh:async()=>{}};
  for(const f of ['db','action-core','actions','sync-merge','sync'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),c);
  await c.HD_DB.dbReady;return c;
}
test('cloud enforces authentication, account isolation and stale-write rollback',async()=>{
  const h=await harness();assert.equal((await h.request('/api/state',{},null)).status,401);
  assert.equal((await h.request('/api/sync',{...post({}),headers:{...post({}).headers,Origin:'https://evil.test'}})).status,403);
  const change={store:'notes',id:'one',value:{id:'one',text:'Private'}};
  assert.equal((await h.request('/api/sync',post({revision:0,changes:[change]}))).status,200);
  assert.equal((await h.request('/api/sync',post({revision:0,changes:[{...change,value:null}]}))).status,409);
  assert.equal((await (await h.request('/api/state')).json()).records['notes/one'].text,'Private');
  assert.deepEqual((await (await h.request('/api/state',{},'other@example.test')).json()).records,{});
});
test('two devices merge independent offline edits and propagate deletions',async()=>{
  const h=await harness(),a=await device(h.request),b=await device(h.request);
  await a.HD_DB.dbPut('notes',{id:'one',text:'Original'});await a.HD_SYNC.start();await b.HD_SYNC.start();
  assert.equal((await b.HD_DB.dbGet('notes','one')).text,'Original');
  await a.HD_DB.dbPut('notes',{id:'two',text:'Tablet edit'});await b.HD_DB.dbPut('shoppingItems',{id:'milk',item:'Milk',checked:false});
  await a.HD_SYNC.sync();await b.HD_SYNC.sync();await a.HD_SYNC.sync();
  assert.equal((await a.HD_DB.dbGet('shoppingItems','milk')).item,'Milk');assert.equal((await b.HD_DB.dbGet('notes','two')).text,'Tablet edit');
  await a.HD_DB.dbDelete('notes','one');await a.HD_SYNC.sync();await b.HD_SYNC.sync();assert.equal(await b.HD_DB.dbGet('notes','one'),undefined);
});
test('competing edits are preserved and visibly block sync',async()=>{
  const h=await harness(),a=await device(h.request),b=await device(h.request);
  await a.HD_DB.dbPut('notes',{id:'one',text:'Original'});await a.HD_SYNC.start();await b.HD_SYNC.start();
  await a.HD_DB.dbPut('notes',{id:'one',text:'Tablet'});await b.HD_DB.dbPut('notes',{id:'one',text:'Phone'});
  await a.HD_SYNC.sync();await b.HD_SYNC.sync();assert.match(b.HD_SYNC.getStatus(),/competing edit/);
  assert.equal((await b.HD_DB.dbGet('notes','one')).text,'Phone');assert.equal((await (await h.request('/api/state')).json()).records['notes/one'].text,'Tablet');
});
test('an edit during upload survives acknowledgement and syncs next time',async()=>{
  const h=await harness();let a,inject=false;
  a=await device(async(path,options)=>{const reply=await h.request(path,options);if(inject&&path==='/api/sync'){inject=false;await a.HD_DB.dbPut('notes',{id:'one',text:'Newer edit'});}return reply;});
  await a.HD_DB.dbPut('notes',{id:'one',text:'First'});await a.HD_SYNC.start();
  await a.HD_DB.dbPut('notes',{id:'one',text:'Uploading'});inject=true;await a.HD_SYNC.sync();
  assert.equal((await a.HD_DB.dbGet('notes','one')).text,'Newer edit');await a.HD_SYNC.sync();
  assert.equal((await (await h.request('/api/state')).json()).records['notes/one'].text,'Newer edit');
});
test('lost write response is recovered from the durable pending operation',async()=>{
  const h=await harness();let lose=false;
  const a=await device(async(path,options)=>{const reply=await h.request(path,options);if(lose&&path==='/api/sync'){lose=false;throw new Error('Disconnected');}return reply;});
  await a.HD_SYNC.start();await a.HD_DB.dbPut('notes',{id:'one',text:'Accepted'});lose=true;await a.HD_SYNC.sync();
  await a.HD_DB.dbPut('notes',{id:'one',text:'Edited after disconnect'});await a.HD_SYNC.sync();
  assert.equal((await (await h.request('/api/state')).json()).records['notes/one'].text,'Edited after disconnect');
});
test('photos cross devices with intact bytes and cannot cross accounts',async()=>{
  const h=await harness(),a=await device(h.request),b=await device(h.request);
  await a.HD_DB.dbPut('photos',{id:'photo',photoBlob:new Blob(['photo-bytes'],{type:'image/png'})});await a.HD_SYNC.start();await b.HD_SYNC.start();
  assert.equal(await (await b.HD_DB.dbGet('photos','photo')).photoBlob.text(),'photo-bytes');
  const key=[...h.assets.keys()][0].split('/')[1];assert.equal((await h.request('/api/photos/'+key,{},'other@example.test')).status,404);
});
test('ChatGPT tools update the same household, deduplicate shopping and completion points',async()=>{
  const h=await harness();
  const call=async(name,args)=>{const response=await h.request('/mcp',post({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}));return (await response.json()).result;};
  const list=await h.request('/mcp',post({jsonrpc:'2.0',id:1,method:'tools/list'}));assert.equal((await list.json()).result.tools.length,4);
  await call('add_shopping_items',{items:['Milk','milk']});await call('add_shopping_items',{items:['Milk']});
  let state=await (await h.request('/api/state')).json();assert.equal(Object.keys(state.records).length,1);
  await h.request('/api/sync',post({revision:state.revision,changes:[{store:'homeWork',id:'task',value:{id:'task',title:'Read',status:'todo',assignedTo:'Kasparas',points:2}}]}));
  assert.equal((await call('change_household_item',{store:'homeWork',id:'task',action:'complete'})).structuredContent.changed,true);
  assert.equal((await call('change_household_item',{store:'homeWork',id:'task',action:'complete'})).structuredContent.changed,false);
  state=await (await h.request('/api/state')).json();assert.equal(state.records['completions/homework:task'].points,2);
});
test('Vinted email imports deduplicate, preserve dismissal, and reject deceptive URLs',async()=>{
  const h=await harness(),{callTool,validVintedURL}=await import('../server/tools.mjs');
  const account=(await (await h.request('/api/state')).json()).account;
  const alert={sourceId:'gmail-message-1',title:'New message',receivedAt:'2026-09-08T12:00:00Z',url:'https://www.vinted.lt/inbox'};
  assert.equal((await callTool(h.DB,account,'import_vinted_alerts',{alerts:[alert,alert]})).imported,1);
  let state=await (await h.request('/api/state')).json(),[key,row]=Object.entries(state.records)[0];
  await h.request('/api/sync',post({revision:state.revision,changes:[{store:'notifications',id:row.id,value:{...row,read:true}}]}));
  assert.equal((await callTool(h.DB,account,'import_vinted_alerts',{alerts:[alert]})).imported,0);
  state=await (await h.request('/api/state')).json();assert.equal(state.records[key].read,true);
  for(const bad of ['javascript:alert(1)','https://vinted.lt.evil.test','https://user@vinted.lt'])assert.throws(()=>validVintedURL(bad));
});
test('cloud midnight follows household time zone across daylight saving',async()=>{
  const {midnightAt,dateAt}=await import('../server/tools.mjs');
  for(const date of ['2026-03-29','2026-10-25','2026-09-08']){const ts=midnightAt(date,'Europe/Vilnius');assert.equal(dateAt(ts,'Europe/Vilnius'),date);assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vilnius',hour:'2-digit',hourCycle:'h23'}).format(new Date(ts)),'00');}
});
