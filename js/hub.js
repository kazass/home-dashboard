/* H4 Home Hub: a stable area registry, live summaries and real household actions. */
(() => {
  const esc=value=>HD_CAL.escapeHtml(String(value??''));
  const today=()=>HD_CAL.ymd(new Date());
  const areas=[{id:'kitchen',title:'Kitchen',icon:'kitchen'},{id:'garden',title:'Garden',icon:'garden'},{id:'housework',title:'Housework',icon:'tasks'},{id:'trips',title:'Trips & plans',icon:'trip'},{id:'sales',title:'Sales & parcels',icon:'sales'},{id:'notes',title:'Notes & ideas',icon:'notes'}];
  let selected=null,timer=null,sequence=0;
  const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
  function layout(){
    const saved=HD_SETTINGS.getSettings().hubTiles;
    const ids=new Set(areas.map(a=>a.id));
    const valid=Array.isArray(saved)?[...new Set(saved.filter(id=>ids.has(id)))]:[];
    return valid.length?valid:areas.map(a=>a.id);
  }
  function editLayout(){
    let draft=layout();
    const panel=HD_UI.dialog('Arrange your home','<div id="hub-layout-editor"></div>');
    const draw=()=>{
      const target=panel.querySelector('#hub-layout-editor');
      target.innerHTML=`<p class="text-muted">Choose your areas and their order. Hiding a tile keeps its records.</p><div class="hub-layout-list">${draft.map((id,index)=>`<div><strong>${areas.find(a=>a.id===id).title}</strong><button data-up="${index}" aria-label="Move ${id} up" ${index===0?'disabled':''}>↑</button><button data-down="${index}" aria-label="Move ${id} down" ${index===draft.length-1?'disabled':''}>↓</button><button data-hide="${id}" aria-label="Hide ${id}" ${draft.length===1?'disabled':''}>×</button></div>`).join('')}</div><div class="hub-actions">${areas.filter(a=>!draft.includes(a.id)).map(a=>`<button data-show="${a.id}">+ ${a.title}</button>`).join('')}</div><div class="v3-form-footer"><button data-reset>Reset</button><button class="primary" data-save>Save layout</button></div>`;
      target.querySelectorAll('[data-up],[data-down]').forEach(b=>b.onclick=()=>{const index=Number(b.dataset.up??b.dataset.down),next=index+(b.hasAttribute('data-up')?-1:1);[draft[index],draft[next]]=[draft[next],draft[index]];draw();});
      target.querySelectorAll('[data-hide]').forEach(b=>b.onclick=()=>{draft=draft.filter(id=>id!==b.dataset.hide);draw();});
      target.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{draft.push(b.dataset.show);draw();});
      target.querySelector('[data-reset]').onclick=()=>{draft=areas.map(a=>a.id);draw();};
      target.querySelector('[data-save]').onclick=()=>{HD_SETTINGS.saveSettings({hubTiles:draft});HD_UI.closeDialog();HD_UI.refresh();HD_UI.toast('Home layout saved.');};
    };draw();
  }
  function stop(){clearInterval(timer);timer=null;document.body.classList.remove('hub-display');}
  function updateClock(){
    const el=document.getElementById('hub-clock');if(!el)return;
    const now=new Date();el.textContent=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});el.dateTime=now.toISOString();
    document.getElementById('hub-date').textContent=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  }
  function displayMode(){
    const isOn=document.body.classList.toggle('hub-display');
    const button=document.getElementById('hub-display-toggle');
    button.setAttribute('aria-pressed',String(isOn));button.innerHTML=HD_ICONS.svg('display')+`<span>${isOn?'Back to home':'Display mode'}</span>`;
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('hub-display'))displayMode();});
  function addTrip(){
    const panel=HD_UI.dialog('Plan a trip',`<form><label>Trip title<input name="title" required maxlength="200" placeholder="A weekend away"></label><div class="v3-form-grid"><label>Start date<input type="date" name="date" required value="${today()}"></label><label>End date<input type="date" name="endDate"></label></div><label>Who is going?<select name="person">${HD_SETTINGS.assigneeOptionsHtml('Both')}</select></label><label>Notes<textarea name="notes"></textarea></label><button class="primary" type="submit">Save trip</button></form>`);
    panel.querySelector('form').onsubmit=event=>{event.preventDefault();const button=event.submitter;button.disabled=true;HD_UI.run(async()=>{
      const fd=new FormData(event.target),title=fd.get('title').trim(),date=fd.get('date'),endDate=fd.get('endDate');
      if(!title)throw new Error('Enter a trip title.');if(endDate&&endDate<date)throw new Error('End date must be on or after the start date.');
      await HD_DB.dbPut('events',{id:crypto.randomUUID(),title,date,endDate:endDate||null,type:'trip',assignedTo:fd.get('person'),notes:fd.get('notes').trim(),createdAt:Date.now()});HD_UI.closeDialog();await HD_UI.refresh();HD_UI.toast('Trip saved.');
    }).finally(()=>{if(button.isConnected)button.disabled=false;});};
  }
  async function renderTrips(host){
    const events=await HD_DB.dbGetAll('events');if(host.dataset.route!=='trips')return;
    const trips=events.filter(e=>e.type==='trip'&&(e.endDate||e.date)>=today()).sort((a,b)=>a.date.localeCompare(b.date));
    host.innerHTML=`<div class="v3-page-heading"><div><h1>Trips &amp; plans</h1><p>Something to look forward to.</p></div><button class="primary" data-add-trip>+ Plan a trip</button></div><div class="hub-trip-list">${trips.length?trips.map(t=>`<button class="v3-surface hub-trip" data-trip-date="${esc(t.date)}">${HD_ICONS.svg('trip')}<span><strong>${esc(t.title)}</strong><small>${esc(t.date)}${t.endDate?' – '+esc(t.endDate):''}</small>${t.notes?`<small>${esc(t.notes)}</small>`:''}</span>${HD_SETTINGS.personBadgeHtml(t.assignedTo||'Both')}</button>`).join(''):'<section class="v3-surface hub-empty"><h2>No trips planned</h2><p>Add a trip to see it here and on your calendar.</p></section>'}</div><a class="hub-inline-link" href="#calendar">Open the full calendar</a>`;
    host.querySelector('[data-add-trip]').onclick=addTrip;
    host.querySelectorAll('[data-trip-date]').forEach(b=>b.onclick=()=>HD_DASHBOARD.openEventModal(b.dataset.tripDate,HD_UI.refresh));
  }
  async function render(host){
    stop();const current=++sequence;
    const [data,sales,ideas]=await Promise.all([HD_TODAY.records(),HD_DB.dbGetAll('sales'),HD_DB.dbGetAll('ideas')]);
    const agenda=await HD_TODAY.agendaForWeek(data,today());
    if(current!==sequence||host.dataset.route!=='dashboard')return;
    const date=today(),tasks=HD_WEEK.taskItems(data),due=tasks.filter(i=>i.due&&i.due<=date),garden=due.filter(i=>i.store==='plants'),work=due.filter(i=>i.store!=='plants');
    const groceries=data.shoppingItems.filter(i=>!i.checked),meal=data.recipes.find(r=>r.id===data.mealPlans.find(p=>p.date===date)?.recipeId);
    const upcoming=agenda.items.filter(e=>!['chore','plant'].includes(e.category)&&(e.endDate||e.date)>=date).sort((a,b)=>a.date.localeCompare(b.date));
    const next=upcoming[0],trips=data.events.filter(e=>e.type==='trip'&&(e.endDate||e.date)>=date).sort((a,b)=>a.date.localeCompare(b.date));
    const parcels=sales.filter(HD_SALES.active),order=layout();if(selected&&!order.includes(selected))selected=null;
    const summaries={kitchen:`${plural(groceries.length,'shopping item')} · ${meal?'Dinner planned':'Plan dinner'}`,garden:garden.length?`${plural(garden.length,'plant')} to water`:data.plants.length?'Watering up to date':'Add your first plant',housework:work.length?`${plural(work.length,'task')} due`:'No tasks due today',trips:trips.length?trips[0].title:'Your next getaway starts here',sales:parcels.length?`${plural(parcels.length,'parcel')} to send`:'Listings, shelf locations & shipping',notes:`${plural(data.notes.length,'note')} · ${plural(ideas.filter(i=>i.status!=='done').length,'idea')}`};
    host.innerHTML=`<section class="hub-home"><div class="hub-hero"><div><time id="hub-clock" class="hub-clock"></time><p id="hub-date"></p></div><div class="hub-hero-right"><button id="hub-display-toggle" aria-pressed="false">${HD_ICONS.svg('display')}<span>Display mode</span></button><a class="hub-next" href="#week">${HD_ICONS.svg('calendar')}<span><small>${next?(next.date<=date?'On today':'Next · '+HD_CAL.parseYMD(next.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})):agenda.complete?'Your week':'Agenda partly loaded'}</small><strong>${esc(next?.title||(agenda.complete?'Nothing scheduled':'Open the weekly view'))}</strong></span>${HD_ICONS.svg('right')}</a></div></div><div class="hub-grid" aria-label="Home areas">${order.map(id=>{
      const area=areas.find(a=>a.id===id);return `<button class="hub-tile ${selected===id?'selected':''}" data-area="${id}" aria-expanded="${selected===id}" aria-controls="hub-detail"><span class="hub-tile-top"><span class="hub-icon">${HD_ICONS.svg(area.icon)}</span>${HD_ICONS.svg('right')}</span><strong>${area.title}</strong><small>${esc(summaries[id])}</small></button>`;
    }).join('')}</div><section id="hub-detail" class="hub-detail v3-surface" aria-label="Selected area"></section><footer class="hub-footer"><a href="#today">Open detailed Today view</a><span>Home 3.5</span><a href="#settings">Appearance &amp; settings</a></footer></section>`;
    const detail=host.querySelector('#hub-detail');
    const drawDetail=()=>{
      host.querySelectorAll('[data-area]').forEach(b=>{b.classList.toggle('selected',b.dataset.area===selected);b.setAttribute('aria-expanded',String(b.dataset.area===selected));});
      if(!selected){detail.innerHTML=`<div class="hub-rest"><div><h2>${due.length?`${plural(due.length,'thing')} to take care of`:'Home, at your pace'}</h2><p>${due.length?'Your tasks and plant care are ready when you are.':'Choose an area above, or add something to your day.'}</p></div><div class="hub-actions"><a class="hub-link" href="#today">${due.length?'See today':'View today'}</a><button data-first-task>+ Add task</button></div></div>`;detail.querySelector('[data-first-task]').onclick=()=>HD_UI.quickAdd('task');return;}
      const area=areas.find(a=>a.id===selected);detail.innerHTML=`<div class="hub-detail-heading"><h2>${area.title}</h2><button class="icon-button" data-close-detail aria-label="Close area">${HD_ICONS.svg('close')}</button></div><div id="hub-area-content"></div>`;
      detail.querySelector('[data-close-detail]').onclick=()=>{const id=selected;selected=null;drawDetail();host.querySelector(`[data-area="${id}"]`).focus();};
      const content=detail.querySelector('#hub-area-content');
      if(selected==='kitchen'){
        content.innerHTML=`<div class="hub-detail-columns"><div><h3>Tonight</h3><p class="hub-dinner-title">${esc(meal?.title||'What’s for dinner?')}</p><button data-plan-dinner>${meal?'Change dinner':'Plan dinner'}</button><a class="hub-inline-link" href="#recipes">Recipes</a></div><div><h3>Shopping</h3>${groceries.slice(0,3).map(i=>`<label class="v3-shopping-item"><input class="v3-check" type="checkbox" data-hub-shop="${esc(i.id)}"><span>${esc(i.item)}${i.qty?' · '+esc(i.qty):''}</span></label>`).join('')||'<p class="text-muted">Your shopping list is clear.</p>'}<div class="hub-actions"><button data-add-shopping>+ Add item</button><a class="hub-link" href="#shopping">Full list</a></div></div></div>`;
        content.querySelector('[data-plan-dinner]').onclick=()=>HD_UI.run(()=>HD_WEEK.planMeal(date));content.querySelector('[data-add-shopping]').onclick=()=>HD_UI.quickAdd('shopping');
        content.querySelectorAll('[data-hub-shop]').forEach(input=>input.onchange=()=>{input.disabled=true;HD_UI.run(async()=>{const undo=await HD_ACTIONS.change('shoppingItems',input.dataset.hubShop,'check',true);await HD_UI.refresh();HD_UI.toast('Marked as purchased.',async()=>{await HD_ACTIONS.undo(undo);await HD_UI.refresh();});}).finally(()=>{if(input.isConnected){input.disabled=false;input.checked=false;}});});
      }else if(selected==='garden'||selected==='housework'){
        const list=selected==='garden'?garden:work;
        content.innerHTML=(list.slice(0,3).map(HD_TODAY.row).join('')||`<p class="text-muted">${selected==='garden'?'No plants need watering today.':'No tasks due today.'}</p>`)+`<div class="hub-actions"><a class="hub-link" href="#${selected==='garden'?'garden':'tasks/all'}">Open ${selected==='garden'?'garden':'all tasks'}</a>${selected==='housework'?'<button data-add-chore>+ Add chore</button>':''}</div>`;
        HD_TODAY.attachRows(content,HD_UI.refresh);content.querySelector('[data-add-chore]')?.addEventListener('click',()=>HD_UI.quickAdd('chore'));
      }else if(selected==='trips'){
        content.innerHTML=`<div class="hub-rest"><div><h3>${esc(trips[0]?.title||'Where next?')}</h3><p>${trips[0]?esc(trips[0].date)+(trips[0].endDate?' – '+esc(trips[0].endDate):''):'Keep travel dates and plans together.'}</p></div><div class="hub-actions"><button data-plan-trip>+ Plan a trip</button><a class="hub-link" href="#trips">View trips</a></div></div>`;content.querySelector('[data-plan-trip]').onclick=addTrip;
      }else if(selected==='sales'){
        content.innerHTML=`<div class="hub-rest"><div><h3>${parcels.length?`${plural(parcels.length,'parcel')} to send`:'A place for every sale'}</h3><p>${parcels.length?parcels.slice(0,3).map(r=>esc(r.title)+(r.location?' · '+esc(r.location):'')).join('<br>'):'Save the item, its shelf location and packing status.'}</p><small class="text-muted">Manual tracking · Vinted is not connected.</small></div><div class="hub-actions"><button data-add-sale>+ Add sale</button><a class="hub-link" href="#sales">Open sales</a></div></div>`;content.querySelector('[data-add-sale]').onclick=()=>HD_SALES.edit();
      }else{
        content.innerHTML=`${data.notes.slice(0,2).map(n=>`<p class="hub-note">${esc(n.text)}</p>`).join('')||'<p class="text-muted">Keep a thought, reminder or idea close by.</p>'}<div class="hub-actions"><button data-add-note>+ Add note</button><a class="hub-link" href="#notes">All notes</a><a class="hub-link" href="#ideas">Ideas</a></div>`;content.querySelector('[data-add-note]').onclick=()=>HD_UI.quickAdd('note');
      }
    };
    drawDetail();host.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{selected=selected===b.dataset.area?null:b.dataset.area;drawDetail();});
    host.querySelector('#hub-display-toggle').onclick=displayMode;updateClock();timer=setInterval(updateClock,10000);
  }
  window.HD_HUB={render,renderTrips,editLayout,stop,layout,areas,addTrip};
})();
