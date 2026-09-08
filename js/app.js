(() => {
  const icon=(name)=>HD_ICONS.svg(name);
  const esc=value=>HD_CAL.escapeHtml(String(value??''));
  let person='Everyone', activeRoute='', sequence=0, toastTimer=null, lastProfile='', lastRoute='';
  const main=()=>document.getElementById('main');
  function closeDialog(){
    document.querySelectorAll('.modal-overlay').forEach(el=>{el.cleanupPhotoUrls?.();el.remove();});
  }
  function dialog(title,html){
    closeDialog();
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    overlay.innerHTML=`<section class="modal v3-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-header"><h2>${esc(title)}</h2><button class="modal-close" aria-label="Close dialog">${icon('close')}</button></header><div class="modal-body">${html}</div></section>`;
    document.body.append(overlay);overlay.querySelector('.modal-close').onclick=closeDialog;overlay.onclick=e=>{if(e.target===overlay)closeDialog();};
    return overlay;
  }
  async function run(action){try{return await action();}catch(error){toast(error.message||'Something went wrong. Please try again.');}}
  function toast(message,undo){
    clearTimeout(toastTimer);document.getElementById('v3-toast')?.remove();
    const el=document.createElement('div');el.id='v3-toast';el.className='v3-toast';el.setAttribute('role','status');
    el.innerHTML=`<span>${esc(message)}</span>${undo?'<button>Undo</button>':''}<button class="v3-toast-close" aria-label="Dismiss notification">×</button>`;document.body.append(el);
    el.querySelector('.v3-toast-close').onclick=()=>el.remove();
    if(undo)el.querySelector('button').onclick=()=>{el.querySelector('button').disabled=true;run(async()=>{await undo();el.remove();});};
    toastTimer=setTimeout(()=>el.remove(),undo?15000:6000);
  }
  function quickAdd(type='task',record=null,after=refresh){
    const title=record?'Edit item':`Add ${type==='shopping'?'shopping item':type}`;
    const task=['task','chore'].includes(type), date=record?(record.dueDate||''):HD_TODAY.chosenDate();
    const overlay=dialog(title,`<form id="v3-add-form"><label>${type==='note'?'Note':type==='shopping'?'Item':'Title'}<input name="title" required maxlength="500" placeholder="${type==='shopping'?'Milk, bread, something good…':type==='note'?'Something to remember…':'What needs doing?'}" value="${esc(record?.title||record?.item||record?.text||'')}"></label>
      ${task?`<div class="v3-form-grid"><label>Assigned to<select name="person">${HD_SETTINGS.assigneeOptionsHtml(record?.assignedTo||(person==='Everyone'?'Both':person))}</select></label>${type==='task'?`<label>Due date<input type="date" name="date" value="${date}"></label>`:`<label>Every<div class="v3-inline-fields"><input name="interval" type="number" min="1" max="365" value="${record?.intervalCount||1}" required aria-label="Repeat interval"><select name="unit" aria-label="Repeat unit">${['days','weeks','months'].map(u=>`<option ${u===(record?.intervalUnit||'weeks')?'selected':''}>${u}</option>`).join('')}</select></div></label>`}</div><details class="v3-details"><summary>More options</summary><label>Notes<textarea name="notes">${esc(record?.notes||'')}</textarea></label><label>Points<input name="points" type="number" min="0" max="1000" value="${record?.points??1}"></label>${type==='chore'?`<label class="v3-checkbox-label"><input type="checkbox" name="rotate" ${record?.rotate?'checked':''}> Rotate between household members</label>`:''}</details>`:''}
      ${type==='shopping'?'<div class="v3-form-grid"><label>Quantity<input name="qty" placeholder="e.g. 2 litres"></label><label>Category<input name="category" placeholder="e.g. Groceries"></label></div>':''}
      <div class="v3-form-footer">${record?'<button type="button" class="danger" data-delete>Delete item</button>':'<span></span>'}<button class="primary" type="submit">${record?'Save changes':'Add '+(type==='shopping'?'item':type)}</button></div></form>`);
    overlay.querySelector('form').onsubmit=event=>{event.preventDefault();const button=event.submitter;button.disabled=true;run(async()=>{
      const fd=new FormData(event.target),title=String(fd.get('title')).trim();if(!title)throw new Error('Please enter a title.');
      const base={...record,id:record?.id||crypto.randomUUID(),createdAt:record?.createdAt||Date.now(),updatedAt:Date.now()};
      if(type==='shopping')await HD_DB.dbPut('shoppingItems',{...base,item:title,qty:fd.get('qty').trim(),category:fd.get('category').trim(),addedBy:person==='Everyone'?'Both':person,checked:false});
      else if(type==='note')await HD_DB.dbPut('notes',{...base,text:title});
      else {
        const item={...base,title,assignedTo:fd.get('person'),notes:fd.get('notes')||'',points:Number(fd.get('points')),currentStreak:record?.currentStreak||0};
        if(type==='chore')await HD_DB.dbPut('scheduling',{...item,category:'chore',recurrenceKind:'interval',anchorDate:record?.anchorDate||HD_TODAY.chosenDate(),intervalCount:Number(fd.get('interval')),intervalUnit:fd.get('unit'),rotate:fd.get('rotate')==='on',lastDoneAt:record?.lastDoneAt||null,completedCount:record?.completedCount||0});
        else await HD_DB.dbPut('homeWork',{...item,status:record?.status||'todo',dueDate:fd.get('date')||null,postponedUntil:null});
      }
      closeDialog();await after();toast(record?'Changes saved.':'Added.');
    }).finally(()=>{if(button.isConnected)button.disabled=false;});};
    overlay.querySelector('[data-delete]')?.addEventListener('click',()=>run(async()=>{
      if(!confirm('Delete this item?'))return;
      await HD_DB.dbDelete(type==='chore'?'scheduling':'homeWork',record.id);closeDialog();await after();toast('Item deleted.');
    }));
  }
  function addMenu(){
    const el=dialog('Quick add',`<div class="v3-add-menu">${[['task','Task','One thing to take care of'],['chore','Chore','Something that repeats'],['shopping','Shopping item','Keep it on the list'],['event','Event','Make a little time'],['note','Note','Remember it for later']].map(([id,title,sub])=>`<button data-add-type="${id}"><strong>${title}</strong><span>${sub}</span><b aria-hidden="true">+</b></button>`).join('')}</div>`);
    el.querySelectorAll('[data-add-type]').forEach(btn=>btn.onclick=()=>{const t=btn.dataset.addType;if(t==='event'){closeDialog();HD_DASHBOARD.openEventModal(HD_TODAY.chosenDate(),refresh);}else quickAdd(t);});
  }
  function editLayout(){
    let draft=structuredClone(HD_WORKSPACE.getLayout());
    const overlay=dialog('Make it yours','<div id="layout-editor"></div>');
    const draw=()=>{
      const host=overlay.querySelector('#layout-editor');
      host.innerHTML=`<p class="text-muted">Choose what stays close. Hidden widgets keep all their data.</p><div class="v3-tabs">${Object.entries({daily:'Daily',week:'Week planner',focus:'Focus'}).map(([key,label])=>`<button data-preset="${key}" class="${draft.preset===key?'active':''}">${label}</button>`).join('')}</div><h3>Your widgets</h3><div class="v3-layout-list">${draft.widgets.map((id,i)=>`<div class="v3-layout-row"><strong>${esc(HD_WORKSPACE.widgets.find(w=>w.id===id).title)}</strong><select data-size="${id}" aria-label="${id} size">${['compact','standard','wide'].map(size=>`<option ${size===draft.sizes[id]?'selected':''}>${size}</option>`).join('')}</select><button data-move="${i}" data-direction="-1" aria-label="Move ${id} up" ${i===0?'disabled':''}>↑</button><button data-move="${i}" data-direction="1" aria-label="Move ${id} down" ${i===draft.widgets.length-1?'disabled':''}>↓</button><button data-hide="${id}" aria-label="Hide ${id}">×</button></div>`).join('')||'<p class="text-muted">Just your priorities. Add a widget below whenever you like.</p>'}</div><h3>Add widgets</h3><div class="v3-widget-picker">${HD_WORKSPACE.widgets.filter(w=>!draft.widgets.includes(w.id)).map(w=>`<button data-widget-add="${w.id}"><strong>${w.title}</strong><span>${w.description}</span></button>`).join('')||'<p>All widgets added.</p>'}</div><div class="v3-form-footer"><button data-reset>Reset this layout</button><div><button data-cancel>Cancel</button> <button class="primary" data-save>Save layout</button></div></div>`;
      host.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{draft=HD_WORKSPACE.normalize({preset:b.dataset.preset});draw();});
      host.querySelectorAll('[data-size]').forEach(s=>s.onchange=()=>{draft.sizes[s.dataset.size]=s.value;});
      host.querySelectorAll('[data-hide]').forEach(b=>b.onclick=()=>{draft.widgets=draft.widgets.filter(id=>id!==b.dataset.hide);draw();});
      host.querySelectorAll('[data-widget-add]').forEach(b=>b.onclick=()=>{draft.widgets.push(b.dataset.widgetAdd);draft.sizes[b.dataset.widgetAdd]='standard';draw();});
      host.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.move),j=i+Number(b.dataset.direction);[draft.widgets[i],draft.widgets[j]]=[draft.widgets[j],draft.widgets[i]];draw();});
      host.querySelector('[data-reset]').onclick=()=>{draft=HD_WORKSPACE.normalize({});draw();};
      host.querySelector('[data-cancel]').onclick=closeDialog;
      host.querySelector('[data-save]').onclick=()=>{HD_WORKSPACE.saveLayout(draft);closeDialog();refresh();toast('Layout saved for this screen.');};
    };draw();
  }
  async function renderSettings(host){
    host.innerHTML='<div class="v3-page-heading"><div><h1>Settings</h1><p>A home dashboard that feels like yours.</p></div></div><div class="v3-settings-grid"><section class="v3-surface" id="appearance"></section><section class="v3-surface"><h2>Layout</h2><p class="text-muted">Choose the home areas you use and arrange their order.</p><button id="settings-layout">Edit layout</button></section><section class="v3-surface"><h2>Your data</h2><p class="text-muted">This version keeps a separate copy of your household data. Import a backup from your original dashboard to bring it here.</p><button id="backup-settings">Backup &amp; restore</button><p class="v3-small">Enable Connections to share data between devices.</p></section><section class="v3-surface"><h2>People &amp; display</h2><p class="text-muted">Household names, person colours, screensaver photos and Spotify.</p><button id="advanced-settings">Open household settings</button></section><section class="v3-surface" id="connection-settings"></section></div>';
    const drawAppearance=()=>{
      const s=HD_SETTINGS.getSettings(),el=host.querySelector('#appearance');
      el.innerHTML=`<h2>Appearance</h2><p class="text-muted">The same layout, a different feeling.</p><div class="v3-theme-grid">${Object.entries(HD_SETTINGS.THEMES).map(([id,t])=>`<button data-v3-theme="${id}" class="${s.theme===id?'selected':''}" aria-pressed="${s.theme===id}"><span class="v3-theme-preview" style="--preview-bg:${(s.mode==='light'?t.light:t.dark)['--bg']};--preview-accent:${t.swatch}"></span>${t.name}</button>`).join('')}</div><label>Colour mode<select id="v3-mode">${['light','dark','system'].map(mode=>`<option value="${mode}" ${(s.mode||'system')===mode?'selected':''}>${mode[0].toUpperCase()+mode.slice(1)}</option>`).join('')}</select></label><label>Text size<select id="v3-text-size"><option value="standard">Standard</option><option value="large" ${s.textSize==='large'?'selected':''}>Large</option></select></label>`;
      el.querySelectorAll('[data-v3-theme]').forEach(b=>b.onclick=()=>{HD_SETTINGS.saveSettings({theme:b.dataset.v3Theme,accentColor:null});HD_SETTINGS.applyAppearance();drawAppearance();});
      el.querySelector('#v3-mode').onchange=e=>{HD_SETTINGS.saveSettings({mode:e.target.value});HD_SETTINGS.applyAppearance();};
      el.querySelector('#v3-text-size').onchange=e=>{HD_SETTINGS.saveSettings({textSize:e.target.value});HD_SETTINGS.applyAppearance();};
    };drawAppearance();
    await HD_SYNC.render(host.querySelector('#connection-settings'));
    host.querySelector('#settings-layout').onclick=HD_HUB.editLayout;
    host.querySelector('#backup-settings').onclick=()=>HD_BACKUP.openBackupModal();
    host.querySelector('#advanced-settings').onclick=()=>HD_SETTINGS.openSettingsModal();
  }
  function header(){
    const el=document.getElementById('v3-header'),date=new Date();
    if(!['Everyone',...HD_SETTINGS.getUserNames()].includes(person))person='Everyone';
    el.innerHTML=`<div class="v3-header-main"><a class="v3-brand" href="#dashboard" aria-label="Home dashboard">${icon('home')}<span>Home</span></a><div class="v3-header-date">${date.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</div><a href="#settings" class="sync-header" data-sync-status>Connect devices</a><div class="v3-header-actions"><button class="icon-button" id="header-search" aria-label="Search everything">${icon('search')}</button><button id="edit-layout">Edit layout</button><button class="primary" id="quick-add">${icon('plus')}<span>Add</span></button></div></div><div id="v3-context-bar"><div class="v3-context-title"><h1 id="workspace-title">Today</h1><p id="workspace-caption">A shared view of your day.</p></div><div class="v3-person-filter" aria-label="Household filter">${['Everyone',...HD_SETTINGS.getUserNames()].map(name=>`<button data-person="${esc(name)}" class="${name===person?'active':''}" aria-pressed="${name===person}">${name==='Everyone'?icon('people'):`<span aria-hidden="true" class="v3-avatar" style="--person-color:${HD_SETTINGS.getPersonColor(name)||'#64766b'}">${esc(name.slice(0,1))}</span>`}<span>${esc(name)}</span></button>`).join('')}</div></div>`;
    el.querySelector('#quick-add').onclick=addMenu;el.querySelector('#edit-layout').onclick=()=>activeRoute==='dashboard'?HD_HUB.editLayout():editLayout;el.querySelector('#header-search').onclick=()=>HD_SEARCH.openSearchModal();
    el.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{person=b.dataset.person;header();refresh();});
  }
  async function renderRoute(){
    const current=++sequence;
    const route=location.hash.slice(1)||'dashboard', root=route.split('/')[0],navigationChanged=route!==lastRoute;
    lastRoute=route;
    closeDialog();
    HD_HUB.stop();
    if(activeRoute==='garden')HD_GARDEN.cleanupPhotoUrls();
    if(['recipes','meals'].includes(activeRoute))HD_RECIPES.cleanupPhotoUrls();
    HD_STATS.closeStatsPanel();activeRoute=root;
    const host=main();host.className='v3-main';host.dataset.route=root;
    document.querySelectorAll('#nav a').forEach(a=>{const id=a.dataset.route;const selected=id===root||(id==='dashboard'&&root==='today')||(id==='week'&&['calendar','trips'].includes(root))||(id==='kitchen'&&['shopping','recipes','meals'].includes(root))||(id==='more'&&!['dashboard','today','week','calendar','trips','tasks','kitchen','shopping','recipes','meals'].includes(root));a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.getElementById('v3-context-bar').hidden=!['today','tasks','week'].includes(root);
    document.getElementById('workspace-title').textContent=root==='tasks'?'Tasks':root==='week'?'Week':'Today';
    document.getElementById('workspace-caption').textContent=root==='tasks'?'Shared tasks and routines.':root==='week'?'':'A shared view of your day.';
    document.getElementById('edit-layout').hidden=!['dashboard','today'].includes(root);
    if(root==='dashboard')await HD_HUB.render(host);
    else if(root==='today')await HD_TODAY.render(host);
    else if(root==='week')await HD_WEEK.render(host);
    else if(root==='sales')await HD_SALES.render(host);
    else if(root==='trips')await HD_HUB.renderTrips(host);
    else if(root==='tasks'&&route!=='tasks/plans')await HD_TODAY.render(host,{full:true,type:route.split('/')[1]||'all'});
    else if(route==='tasks/plans'){
      host.innerHTML='<div class="v3-page-heading"><h1>Recurring plans</h1><a href="#tasks">Back to tasks</a></div><section class="v3-surface" id="plans-content"></section>';HD_SCHEDULING.renderPlansContent(host.querySelector('#plans-content'));
    }else if(root==='calendar'){
      host.innerHTML='<div class="v3-page-heading"><div><h1>Calendar</h1><p>A little space for everything ahead.</p></div><button class="primary" id="add-event">+ Add event</button></div><section class="v3-surface v3-calendar" id="full-calendar"></section>';
      host.querySelector('#add-event').onclick=()=>HD_DASHBOARD.openEventModal(HD_CAL.ymd(new Date()),refresh);
      await HD_CAL.renderCalendar(host.querySelector('#full-calendar'),date=>HD_DASHBOARD.openEventModal(date,refresh));
    }else if(root==='settings')await renderSettings(host);
    else if(root==='more'||root==='kitchen'){
      const kitchen=[{id:'shopping',title:'Shopping',description:'The list for your next trip to the shops'},{id:'recipes',title:'Recipes',description:'Good food, worth making again'},{id:'meals',title:'Meal plan',description:'A week of something delicious'}];
      const list=root==='kitchen'?kitchen:HD_WORKSPACE.features.filter(f=>!f.primary);
      host.innerHTML=`<div class="v3-page-heading"><div><h1>${root==='kitchen'?'Kitchen':'More for your home'}</h1><p>${root==='kitchen'?'From a good idea to the dinner table.':'All the little things that make a home.'}</p></div>${root==='more'?'<button id="search-all">Search everything</button>':''}</div><div class="v3-feature-grid">${list.map(f=>`<a class="v3-surface v3-feature" href="#${f.id}"><span class="v3-feature-icon">${icon(f.id==='recipes'||f.id==='meals'?'kitchen':f.id)}</span><span class="v3-feature-arrow">${icon('arrow')}</span><h2>${f.title}</h2><p>${f.description}</p></a>`).join('')}</div>`;
      host.querySelector('#search-all')?.addEventListener('click',()=>HD_SEARCH.openSearchModal());
    }else if(root==='about'){
      host.innerHTML='<div class="v3-page-heading"><h1>Home dashboard</h1></div><section class="v3-surface"><h2>Version '+esc(HD_CHANGELOG.APP_VERSION)+'</h2><button id="release-notes">Release notes</button></section>';
      host.querySelector('#release-notes').onclick=HD_CHANGELOG.openChangelogModal;
    }else if(root==='stats'){
      host.innerHTML='<div class="v3-page-heading"><div><h1>Shared progress</h1><p>Every little bit counts.</p></div></div><section class="v3-surface v3-stats-page"></section>';
      const html=await HD_STATS.buildStatsHtml();if(current===sequence)host.querySelector('section').innerHTML=html;
    }else if(['goals','activities'].includes(root)){
      host.innerHTML=`<div class="v3-page-heading"><h1>${root==='goals'?'Family goal':'Activities'}</h1></div><section class="v3-surface"></section>`;
      if(root==='goals')HD_GOAL.renderGoalCard(host.querySelector('section'));else HD_ACTIVITIES.renderActivitiesCard(host.querySelector('section'));
    }else if(['decide','music'].includes(root)){
      host.innerHTML=`<div class="v3-page-heading"><h1>${root==='decide'?'A little help choosing':'Music'}</h1></div><section class="v3-surface"></section>`;await HD_TODAY.renderWidget(host.querySelector('section'),root,{},refresh);
    }else {
      const renderers={garden:HD_GARDEN.renderGardenTab,notes:HD_NOTES.renderNotesTab,ideas:HD_IDEAS.renderIdeasTab,shopping:HD_SHOPPING.renderShoppingTab,recipes:HD_RECIPES.renderRecipesTab,meals:HD_RECIPES.renderRecipesTab};
      if(renderers[root]){host.classList.add('v3-legacy');await renderers[root](host);if(root==='meals')host.querySelector('[data-sub="mealplan"]')?.click();}
      else {location.hash='dashboard';return;}
    }
    if(current!==sequence)return;
    enhance(host);
    if(navigationChanged)window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  function enhance(host){
    host.querySelectorAll('input:not([aria-label]),textarea:not([aria-label]),select:not([aria-label])').forEach(input=>{if(!input.closest('label'))input.setAttribute('aria-label',input.placeholder||input.name||'Choose an option');});
    const form=host.querySelector(':scope > form.inline-form');
    if(form&&!form.closest('details')){const details=document.createElement('details');details.className='v3-add-details';const summary=document.createElement('summary');summary.textContent='Add '+({garden:'plant',notes:'note',ideas:'idea',shopping:'item',recipes:'recipe'}[activeRoute]||'item');form.before(details);details.append(summary,form);}
  }
  function refresh(){return run(renderRoute);}
  let previousFocus=null;
  function setupDialogs(){
    let currentOverlay=null;
    const synchronize=()=>{
      const overlays=[...document.querySelectorAll('.modal-overlay')],overlay=overlays.at(-1),app=document.getElementById('app');
      if(!overlay){
        app.inert=false;document.body.classList.remove('dialog-open');currentOverlay=null;
        if(previousFocus?.isConnected)previousFocus.focus();previousFocus=null;return;
      }
      if(currentOverlay!==overlay){
        if(!currentOverlay)previousFocus=document.activeElement;
        currentOverlay=overlay;overlays.slice(0,-1).forEach(other=>{other.cleanupPhotoUrls?.();other.remove();});HD_STATS.closeStatsPanel();
      }
      app.inert=true;document.body.classList.add('dialog-open');
      const modal=overlay.querySelector('.modal');
      if(!modal)return;
      if(modal.dataset.accessibleReady)return;
      modal.dataset.accessibleReady='true';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
      modal.setAttribute('aria-label',modal.querySelector('h2,h3')?.textContent||'Dialog');modal.tabIndex=-1;
      enhance(overlay);
      requestAnimationFrame(()=>{
        if(!overlay.isConnected)return;
        const visible=el=>el&&!el.disabled&&el.getClientRects().length;
        const fields=[...overlay.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]),select,textarea')];
        (fields.find(visible)||[...overlay.querySelectorAll('button')].find(visible)||modal).focus();
      });
    };
    new MutationObserver(synchronize).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('keydown',e=>{
      const overlay=document.querySelector('.modal-overlay');if(!overlay)return;
      if(e.key==='Escape'){e.preventDefault();closeDialog();return;}
      if(e.key==='Tab'){
        const focusable=[...overlay.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1);if(!first){e.preventDefault();return;}
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
  }
  window.HD_UI={dialog,closeDialog,toast,run,quickAdd,editLayout,refresh,getPerson:()=>person};
  window.HD_APP={updateSpotifyEmbed:()=>{if(activeRoute==='music')refresh();}};
  window.addEventListener('hashchange',refresh);
  window.addEventListener('DOMContentLoaded',()=>{
    document.body.classList.add('v3','v35');
    const headerEl=document.createElement('header');headerEl.id='v3-header';document.getElementById('app').prepend(headerEl);
    HD_SETTINGS.applyAppearance();header();
    document.getElementById('nav').innerHTML=HD_WORKSPACE.features.filter(f=>f.primary).map(f=>`<a href="#${f.id}" data-route="${f.id}">${icon(f.id==='dashboard'?'home':f.id==='week'?'calendar':f.id)}<span>${f.title}</span></a>`).join('');
    setupDialogs();refresh();HD_SCREENSAVER.initScreensaver();
    lastProfile=HD_WORKSPACE.profile();let resizeTimer;
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const next=HD_WORKSPACE.profile();if(next!==lastProfile){lastProfile=next;if(activeRoute==='dashboard')refresh();}},250);});
    let lastDay=HD_CAL.ymd(new Date());setInterval(()=>{const now=HD_CAL.ymd(new Date());if(now!==lastDay&&!document.querySelector('.modal-overlay')){lastDay=now;header();if(activeRoute==='dashboard')refresh();}},60000);
    if('serviceWorker' in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    navigator.storage?.persist?.().catch(()=>false);
  });
})();
