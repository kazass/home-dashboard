/* Manual household sales. There is deliberately no implied Vinted connection. */
(() => {
  const esc = value => HD_CAL.escapeHtml(String(value ?? ''));
  const statuses = {listed:'Listed',pack:'To pack',ready:'Ready to send',sent:'Sent',complete:'Complete'};
  const active = record => ['pack','ready'].includes(record.status);
  let filter='active', sequence=0;
  function validate(record) {
    if(!record.title?.trim()) throw new Error('Enter an item title.');
    if(!Object.hasOwn(statuses,record.status)) throw new Error('Choose a valid status.');
    if(record.shipBy && (!/^\d{4}-\d{2}-\d{2}$/.test(record.shipBy)||HD_CAL.ymd(HD_CAL.parseYMD(record.shipBy))!==record.shipBy)) throw new Error('Choose a valid dispatch date.');
    return record;
  }
  function edit(record=null) {
    const panel=HD_UI.dialog(record?'Edit sale':'Add sale',`<form id="sale-form"><label>Item title<input name="title" required maxlength="200" value="${esc(record?.title)}" placeholder="Book title or item name"></label><div class="v3-form-grid"><label>Status<select name="status">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${key===(record?.status||'pack')?'selected':''}>${label}</option>`).join('')}</select></label><label>Send by<input type="date" name="shipBy" value="${esc(record?.shipBy)}"></label></div><label>Shelf or storage location<input name="location" maxlength="100" value="${esc(record?.location)}" placeholder="e.g. Books · shelf B2"></label><label>Listing link (optional)<input type="url" name="url" value="${esc(record?.url)}" placeholder="https://..."></label><label>Notes<textarea name="notes" maxlength="2000">${esc(record?.notes)}</textarea></label><div class="v3-form-footer">${record?'<button type="button" class="danger" data-remove>Delete sale</button>':'<span></span>'}<button class="primary" type="submit">${record?'Save changes':'Add sale'}</button></div></form>`);
    panel.querySelector('form').onsubmit=event=>{
      event.preventDefault(); const button=event.submitter;button.disabled=true;
      HD_UI.run(async()=>{
        const fd=new FormData(event.target),url=fd.get('url').trim();
        if(url&&!HD_SETTINGS.safeExternalUrl(url))throw new Error('Use an http or https listing link.');
        const next=validate({...record,id:record?.id||crypto.randomUUID(),title:fd.get('title').trim(),status:fd.get('status'),shipBy:fd.get('shipBy'),location:fd.get('location').trim(),url,notes:fd.get('notes').trim(),createdAt:record?.createdAt||Date.now(),updatedAt:Date.now()});
        await HD_DB.dbPut('sales',next);HD_UI.closeDialog();await HD_UI.refresh();HD_UI.toast('Sale saved.');
      }).finally(()=>{if(button.isConnected)button.disabled=false;});
    };
    panel.querySelector('[data-remove]')?.addEventListener('click',()=>HD_UI.run(async()=>{
      if(!confirm(`Delete “${record.title}”?`))return;
      await HD_DB.dbDelete('sales',record.id);HD_UI.closeDialog();await HD_UI.refresh();HD_UI.toast('Sale deleted.');
    }));
  }
  async function setStatus(id,status){
    if(!Object.hasOwn(statuses,status))throw new Error('Choose a valid status.');
    const db=await HD_DB.dbReady;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('sales','readwrite'),store=tx.objectStore('sales'),req=store.get(id);
      req.onsuccess=()=>{if(!req.result){tx.abort();return;}store.put({...req.result,status,updatedAt:Date.now()});};
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('This sale no longer exists.'));
    });
  }
  async function render(host){
    const current=++sequence,data=await HD_DB.dbGetAll('sales');
    if(location.hash==='#sales/all')filter='all';
    if(current!==sequence||host.dataset.route!=='sales')return;
    const shown=data.filter(r=>filter==='all'||(filter==='active'?r.status!=='complete'&&r.status!=='sent':r.status==='complete'||r.status==='sent')).sort((a,b)=>(a.shipBy||'9999').localeCompare(b.shipBy||'9999'));
    host.innerHTML=`<div class="v3-page-heading"><div><h1>Sales &amp; parcels</h1><p>Track your items from shelf to sent.</p></div><button class="primary" data-add-sale>+ Add sale</button></div><div class="hub-notice">Manual tracking · Vinted notifications are not connected.</div><div class="v3-tabs" aria-label="Sales filter">${[['active','Active'],['sent','Sent & complete'],['all','All']].map(([key,label])=>`<button data-sales-filter="${key}" class="${filter===key?'active':''}" aria-pressed="${filter===key}">${label}</button>`).join('')}</div><div class="sales-list">${shown.length?shown.map(r=>`<article class="sale-row v3-surface"><div class="hub-icon">${HD_ICONS.svg('sales')}</div><div class="sale-copy"><button class="sale-title" data-edit-sale="${esc(r.id)}">${esc(r.title)}</button><p>${esc(r.location||'No storage location')}${r.shipBy?` · Send by ${esc(r.shipBy)}`:''}</p>${r.notes?`<p>${esc(r.notes)}</p>`:''}${HD_SETTINGS.safeExternalUrl(r.url)?`<a class="hub-inline-link" href="${esc(HD_SETTINGS.safeExternalUrl(r.url))}" target="_blank" rel="noopener noreferrer">Open listing ↗</a>`:''}</div><label class="sale-status">Status<select data-sale-status="${esc(r.id)}">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${key===r.status?'selected':''}>${label}</option>`).join('')}</select></label></article>`).join(''):`<section class="v3-surface hub-empty"><h2>${data.length?'No sales in this view':'No sales here yet'}</h2><p>${data.length?'Choose another filter to see your other sales.':'Add an item with its shelf location and send-by date.'}</p><button data-add-sale>${data.length?'Add a sale':'Add your first sale'}</button></section>`}</div>`;
    host.querySelectorAll('[data-add-sale]').forEach(b=>b.onclick=()=>edit());
    host.querySelectorAll('[data-sales-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.salesFilter;if(location.hash==='#sales/all')location.hash='sales';else HD_UI.refresh();});
    host.querySelectorAll('[data-edit-sale]').forEach(b=>b.onclick=()=>edit(data.find(r=>r.id===b.dataset.editSale)));
    host.querySelectorAll('[data-sale-status]').forEach(select=>select.onchange=()=>{select.disabled=true;HD_UI.run(async()=>{await setStatus(select.dataset.saleStatus,select.value);await HD_UI.refresh();HD_UI.toast('Status saved.');}).finally(()=>{if(select.isConnected)select.disabled=false;});});
  }
  window.HD_SALES={render,edit,active,statuses,validate,setStatus};
})();
