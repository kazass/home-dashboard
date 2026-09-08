(() => {
  const esc=value=>HD_CAL.escapeHtml(String(value??''));
  async function render(host){
    if(!host)return;
    const alerts=(await HD_DB.dbGetAll('notifications')).filter(n=>!n.read).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));
    host.innerHTML=`<div class="v3-surface notification-inbox"><h2>Vinted alerts <span class="v3-small">${alerts.length||''}</span></h2>${alerts.length?alerts.slice(0,30).map(a=>`<article class="notification-row"><details><summary>${esc(a.title)} <span class="v3-small">${esc(new Date(a.receivedAt).toLocaleDateString())}</span></summary><p>${esc(a.summary)}</p>${HD_SETTINGS.safeExternalUrl(a.url)?`<a href="${esc(HD_SETTINGS.safeExternalUrl(a.url))}" target="_blank" rel="noopener noreferrer">Open in Vinted ↗</a>`:''}</details><button data-dismiss-alert="${esc(a.id)}" aria-label="Dismiss ${esc(a.title)}">Dismiss</button></article>`).join(''):'<p class="text-muted">No imported alerts. After linking your mailbox and household in ChatGPT, ask to bring in your latest Vinted notifications.</p><a class="hub-inline-link" href="#settings">Connection settings →</a>'}</div>`;
    host.querySelectorAll('[data-dismiss-alert]').forEach(button=>button.onclick=()=>HD_UI.run(async()=>{
      const record=await HD_DB.dbGet('notifications',button.dataset.dismissAlert);if(!record)return;
      await HD_DB.dbPut('notifications',{...record,read:true});await render(host);
      HD_UI.toast('Alert dismissed.',async()=>{await HD_DB.dbPut('notifications',{...record,read:false});await render(host);});
    }));
  }
  window.HD_NOTIFICATIONS={render};
})();
