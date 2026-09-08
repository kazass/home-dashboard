/* IndexedDB remains the offline working copy; D1 is the shared authority.
   A durable baseline supports three-way merges, including deletions. */
(() => {
  const {equal,merge,diff}=HD_SYNC_MERGE;
  let busy=false,timer,status='Checking connection…',conflict=null,lastEncoded=null;
  const assetHashes=new WeakMap(),uploaded=new Set();
  const esc=value=>HD_CAL.escapeHtml(String(value??''));
  function announce(text){status=text;document.querySelectorAll('[data-sync-status]').forEach(el=>el.textContent=text);}
  async function api(path,options={}){
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
    if(!response.ok){let message='Connection unavailable. Your edits are saved on this device.';try{message=(await response.json()).error||message;}catch{}throw Object.assign(new Error(message),{status:response.status});}
    return response;
  }
  async function readLocal(){
    const db=await HD_DB.dbReady;
    return new Promise((resolve,reject)=>{
      const tx=db.hdRawTransaction([...HD_DB.STORES,'_sync'],'readonly'),records={};let meta={},generation;
      for(const store of HD_DB.STORES){const req=tx.objectStore(store).getAll();req.onsuccess=()=>req.result.forEach(r=>records[`${store}/${r.id}`]=r);}
      const req=tx.objectStore('_sync').get('baseline');req.onsuccess=()=>{meta=req.result||{};};
      const gen=tx.objectStore('_sync').get('generation');gen.onsuccess=()=>{generation=gen.result?.value;};
      tx.oncomplete=()=>resolve({records,meta,generation});tx.onabort=()=>reject(tx.error);
    });
  }
  async function saveMeta(meta){const db=await HD_DB.dbReady;return new Promise((resolve,reject)=>{const tx=db.hdRawTransaction('_sync','readwrite');tx.objectStore('_sync').put({...meta,id:'baseline'});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}
  async function encode(records){
    const result={};
    for(const [key,row] of Object.entries(records)){
      const copy={...row};
      for(const [field,value] of Object.entries(copy))if(value instanceof Blob){
        let hash=assetHashes.get(value);
        if(!hash){hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await value.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');assetHashes.set(value,hash);}
        if(!uploaded.has(hash)){await api(`/api/photos/${hash}`,{method:'PUT',headers:{'Content-Type':value.type||'image/jpeg'},body:value});uploaded.add(hash);}
        copy[field]={__asset:hash,type:value.type};
      }result[key]=copy;
    }return result;
  }
  async function decode(records,local,wire){
    const output={};
    for(const [key,row] of Object.entries(records)){
      const copy={...row};
      for(const [field,value] of Object.entries(copy))if(value?.__asset){
        copy[field]=wire[key]?.[field]?.__asset===value.__asset&&local[key]?.[field] instanceof Blob?local[key][field]:await (await api(`/api/photos/${value.__asset}`)).blob();
      }output[key]=copy;
    }return output;
  }
  async function accept(local,wire,remote,meta){
    const decoded=await decode(remote.records,local.records,wire),db=await HD_DB.dbReady;
    return new Promise((resolve,reject)=>{
      const tx=db.hdRawTransaction([...HD_DB.STORES,'_sync'],'readwrite'),req=tx.objectStore('_sync').get('generation');let changed=false;
      req.onsuccess=()=>{
        if(req.result?.value===local.generation){
          for(const c of diff(wire,remote.records)){const store=tx.objectStore(c.store);if(c.value===null)store.delete(c.id);else store.put(decoded[`${c.store}/${c.id}`]);changed=true;}
          if(changed)tx.objectStore('_sync').put({id:'generation',value:crypto.randomUUID()});
          meta.base=remote.records;
        }else{
          // Someone edited while the request was in flight. Acknowledge only
          // our accepted writes; leave other incoming changes for the next merge.
          const base={...(meta.base||{})};
          for(const key of new Set([...Object.keys(wire),...Object.keys(remote.records)]))if(equal(wire[key],remote.records[key])){if(remote.records[key]===undefined)delete base[key];else base[key]=remote.records[key];}
          meta.base=base;
        }
        tx.objectStore('_sync').put({...meta,id:'baseline',pending:null,revision:remote.revision});
      };
      tx.oncomplete=()=>resolve(changed);tx.onabort=()=>reject(tx.error);
    });
  }
  function acknowledgePending(base,pending,remote){
    const next={...base};if(!pending)return next;
    for(const c of diff(pending.before,pending.sent)){const key=`${c.store}/${c.id}`;if(equal(remote[key],pending.sent[key])){if(remote[key]===undefined)delete next[key];else next[key]=remote[key];}}
    return next;
  }
  async function cycle(start=false){
    if(busy)return;busy=true;
    try{
      const local=await readLocal();if(!local.meta.enabled&&!start){announce('Sync is ready to set up');return;}
      announce('Syncing…');const remote=await (await api('/api/state')).json();
      if(local.meta.account&&remote.account!==local.meta.account)throw new Error('This device belongs to another signed-in household. Export its data before switching accounts.');
      const meta={...local.meta,enabled:true,account:remote.account};
      const wire=lastEncoded && lastEncoded.generation===local.generation?lastEncoded.wire:await encode(local.records);
      lastEncoded={generation:local.generation,wire};
      const base=acknowledgePending(meta.base||{},meta.pending,remote.records);
      const merged=merge(base,wire,remote.records);
      if(merged.conflicts.length){conflict={keys:merged.conflicts};announce(`${merged.conflicts.length} competing edit${merged.conflicts.length===1?'':'s'} · Review in Connections`);return;}
      conflict=null;let changes=diff(remote.records,merged.records);
      // Bound each transaction. A large first import safely continues next cycle.
      const chunk=changes.slice(0,500),sent={...remote.records};
      for(const c of chunk){const k=`${c.store}/${c.id}`;if(c.value===null)delete sent[k];else sent[k]=c.value;}
      if(chunk.length){
        meta.pending={before:remote.records,sent};await saveMeta({...meta,base});
        const reply=await (await api('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:remote.revision,changes:chunk})})).json();
        remote.revision=reply.revision;remote.records=sent;
      }
      // For batches >500 keep unsent local changes. accept sees a generation
      // mismatch, acknowledges this batch, and the next cycle sends the remainder.
      const target=changes.length>500?{...local,generation:'pending-batch'}:local;
      const changed=await accept(target,wire,remote,{...meta,base});
      if(changed){lastEncoded=null;await applyPeople();if(!document.querySelector('.modal-overlay')&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))await HD_UI.refresh();}
      announce(changes.length>500?'Syncing remaining records…':`Synced at ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`);
      if(changes.length>500)setTimeout(()=>sync(),500);
    }catch(error){announce(error.status===409?'Another device changed · syncing again…':error.message);if(error.status===409)setTimeout(()=>sync(),500);}
    finally{busy=false;}
  }
  async function sync(start=false){
    if(navigator.locks)return navigator.locks.request('hd-household-sync',{ifAvailable:true},lock=>lock?cycle(start):undefined);
    return cycle(start);
  }
  async function applyPeople(){
    const profile=await HD_DB.dbGet('household','profile');
    if(profile?.userNames?.length&& !equal(profile.userNames,HD_SETTINGS.getUserNames()))(window.HD_STORAGE||localStorage).setItem('hd-settings',JSON.stringify({...HD_SETTINGS.getSettings(),userNames:profile.userNames}));
  }
  async function start(){
    const remote=await (await api('/api/state')).json();
    if(!Object.keys(remote.records).length && !(await HD_DB.dbGet('household','profile')))await HD_DB.dbPut('household',{id:'profile',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Vilnius',userNames:HD_SETTINGS.getUserNames()});
    await sync(true);await render(document.querySelector('#connection-settings'));
  }
  async function resolveConflict(choice){
    // Preserve a downloadable recovery copy before changing conflict baselines.
    await HD_BACKUP.exportBackup();
    const local=await readLocal(),remote=await (await api('/api/state')).json(),wire=await encode(local.records);
    if(remote.account!==local.meta.account&&local.meta.account)throw new Error('Household account changed.');
    const base=acknowledgePending(local.meta.base||{},local.meta.pending,remote.records),localChanges=diff(base,wire);
    if(choice==='cloud'){
      // Discard the entire pending local group so task/log pairs stay consistent.
      await accept(local,wire,remote,{...local.meta,base:remote.records,enabled:true,account:remote.account});
    }else{
      // Local pending group wins; all unrelated shared records are retained.
      const merged={...remote.records};for(const c of localChanges){const k=`${c.store}/${c.id}`;if(c.value===null)delete merged[k];else merged[k]=c.value;}
      const changes=diff(remote.records,merged);if(changes.length>500)throw new Error('Resolve this large import by exporting and reviewing the backup first.');
      await saveMeta({...local.meta,account:remote.account,enabled:true,pending:{before:remote.records,sent:merged}});
      const result=await (await api('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:remote.revision,changes})})).json();
      await accept(local,wire,{revision:result.revision,records:merged},{...local.meta,enabled:true,account:remote.account});
    }
    conflict=null;await applyPeople();await sync();await HD_UI.refresh();
  }
  async function render(host){
    if(!host)return;const local=await readLocal();
    host.innerHTML=`<h2>Connections</h2><p class="sync-status" data-sync-status role="status">${esc(status)}</p><p class="text-muted">Use the same ChatGPT account on your phone and tablet. Tasks, lists, plans, sales and photos sync; appearance stays personal to each device.</p><div class="sync-actions"><button class="primary" data-start-sync>${local.meta.enabled?'Sync now':'Connect this device'}</button><button data-export>Export recovery copy</button></div>${!local.meta.enabled?'<p class="v3-small">Connect uploads this device’s records and combines them with your shared household. Conflicting records are kept for review.</p>':''}${conflict?`<div class="sync-conflict"><h3>Choose which pending edits to keep</h3><p>${conflict.keys.slice(0,5).map(esc).join(', ')}</p><p>A recovery copy will download first. This choice applies to the complete pending group, including completion points.</p><button data-resolve="local">Keep this device’s edits</button><button data-resolve="cloud">Use shared edits</button></div>`:''}<hr><h3>ChatGPT actions</h3><p class="text-muted">Shopping, task actions and Vinted email imports are prepared. Activating the household link requires Sites connections to be available for your ChatGPT account; device sync works separately.</p><p class="v3-small">After activation, try “What is due today?” or “Add milk to shopping.”</p><hr><h3>Vinted email alerts</h3><p class="text-muted">After activating the household link, connect the mailbox receiving your Vinted notifications in ChatGPT and ask to import those alerts. Sales status stays under your control.</p><a class="hub-inline-link" href="#sales">Open sales &amp; alerts →</a>`;
    host.querySelector('[data-start-sync]').onclick=()=>HD_UI.run(start);
    host.querySelector('[data-export]').onclick=()=>HD_UI.run(()=>HD_BACKUP.exportBackup());
    host.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>HD_UI.run(()=>resolveConflict(b.dataset.resolve)));
  }
  window.HD_SYNC={sync,start,render,readLocal,acknowledgePending,getStatus:()=>status};
  window.addEventListener('hd-data-changed',()=>{clearTimeout(timer);timer=setTimeout(()=>sync(),1200);});
  window.addEventListener('online',()=>sync());
  window.addEventListener('DOMContentLoaded',()=>{sync();setInterval(()=>{if(!document.hidden)sync();},15000);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
})();
