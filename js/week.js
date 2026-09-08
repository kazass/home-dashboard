/* One planning surface, using the same records and actions as the other views. */
(() => {
  const esc=value=>HD_CAL.escapeHtml(String(value??''));
  const today=()=>HD_CAL.ymd(new Date());
  let selected=null,sequence=0;
  const keyOf=line=>line.trim().replace(/\s+/g,' ').toLocaleLowerCase();
  function ingredientsForRange(data,start,end){
    const selectedRecipes=new Set(data.mealPlans.filter(p=>p.date>=start&&p.date<=end).map(p=>p.recipeId));
    const existing=new Set(data.shoppingItems.filter(i=>!i.checked).map(i=>keyOf(i.item)));
    const unique=new Map();
    data.recipes.filter(r=>selectedRecipes.has(r.id)).forEach(recipe=>String(recipe.ingredients||'').split('\n').map(l=>l.trim()).filter(Boolean).forEach(line=>{
      const key=keyOf(line);if(!unique.has(key))unique.set(key,{line,alreadyAdded:existing.has(key)});
    }));
    return [...unique.values()];
  }
  async function addIngredients(lines){
    const db=await HD_DB.dbReady;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('shoppingItems','readwrite'),store=tx.objectStore('shoppingItems'),req=store.getAll();let count=0;
      req.onsuccess=()=>{
        const existing=new Set(req.result.filter(i=>!i.checked).map(i=>keyOf(i.item)));
        for(const raw of lines){const item=String(raw).trim(),key=keyOf(item);if(!item||existing.has(key))continue;existing.add(key);store.put({id:crypto.randomUUID(),item,qty:'',category:'Meal plan',addedBy:'Both',checked:false,createdAt:Date.now()});count++;}
      };
      tx.oncomplete=()=>resolve(count);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Shopping items could not be saved.'));
    });
  }
  async function reviewIngredients(start,end){
    const data=await HD_TODAY.records(),lines=ingredientsForRange(data,start,end);
    const panel=HD_UI.dialog('Review ingredients',`<p class="text-muted">${esc(start)} – ${esc(end)}. Untick anything you already have. Matching ingredient lines are added only once.</p>${lines.length?`<form><div class="ingredient-list">${lines.map((item,index)=>`<label><input type="checkbox" name="ingredient" value="${index}" ${item.alreadyAdded?'disabled':'checked'}><span>${esc(item.line)}${item.alreadyAdded?'<small>Already on your list</small>':''}</span></label>`).join('')}</div><button class="primary" type="submit">Add selected to shopping</button></form>`:'<p>No ingredients to add. Plan a saved recipe with ingredients first.</p><a class="hub-link" href="#recipes">Open recipes</a>'}`);
    panel.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();const button=event.submitter;button.disabled=true;HD_UI.run(async()=>{
      const selectedLines=new FormData(event.target).getAll('ingredient').map(i=>lines[Number(i)]?.line).filter(Boolean);
      const count=await addIngredients(selectedLines);HD_UI.closeDialog();await HD_UI.refresh();HD_UI.toast(count?`${count} ingredient${count===1?'':'s'} added to shopping.`:'Shopping list is already up to date.');
    }).finally(()=>{if(button.isConnected)button.disabled=false;});});
  }
  async function planMeal(date=today()){
    const [recipes,plans]=await Promise.all([HD_DB.dbGetAll('recipes'),HD_DB.dbGetAll('mealPlans')]);
    const current=plans.find(p=>p.date===date);
    const panel=HD_UI.dialog('Plan dinner',recipes.length?`<form><label>Date<input name="date" type="date" required value="${esc(date)}"></label><label>Recipe<select name="recipe"><option value="">No dinner planned</option>${recipes.map(r=>`<option value="${esc(r.id)}" ${r.id===current?.recipeId?'selected':''}>${esc(r.title)}</option>`).join('')}</select></label><button class="primary" type="submit">Save dinner</button></form>`:'<p>Save a recipe first, then choose a day for it.</p><a class="hub-link" href="#recipes">Add a recipe</a>');
    panel.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();const button=event.submitter;button.disabled=true;HD_UI.run(async()=>{
      const fd=new FormData(event.target),date=fd.get('date'),recipeId=fd.get('recipe');
      if(recipeId)await HD_DB.dbPut('mealPlans',{id:date,date,recipeId,createdAt:Date.now()});else await HD_DB.dbDelete('mealPlans',date);
      HD_UI.closeDialog();await HD_UI.refresh();HD_UI.toast('Dinner plan saved.');
    }).finally(()=>{if(button.isConnected)button.disabled=false;});});
  }
  function taskItems(data){
    return [...data.homeWork.filter(r=>r.status!=='done').map(record=>({store:'homeWork',record})),...data.scheduling.filter(r=>r.category==='chore').map(record=>({store:'scheduling',record})),...data.plants.map(record=>({store:'plants',record}))]
      .map(item=>({...item,due:HD_ACTIONS.nextDue(item.store,item.record)}));
  }
  async function render(host){
    const current=++sequence,date=selected||today(),data=await HD_TODAY.records(),agenda=await HD_TODAY.agendaForWeek(data,date);
    if(current!==sequence||host.dataset.route!=='week')return;
    const person=HD_UI.getPerson(),tasks=taskItems(data).filter(i=>person==='Everyone'||!i.record.assignedTo||i.record.assignedTo==='Both'||i.record.assignedTo===person);
    const days=Array.from({length:7},(_,i)=>HD_CAL.addDays(agenda.start,i)),end=HD_CAL.ymd(days[6]);
    const mealFor=key=>data.recipes.find(r=>r.id===data.mealPlans.find(p=>p.date===key)?.recipeId);
    const eventsFor=key=>HD_TODAY.agendaItemsOnDate(agenda.items,key,person);
    const tasksFor=key=>tasks.filter(i=>i.due&&(i.due===key||(key===today()&&i.due<key)));
    host.innerHTML=`<div class="v3-page-heading week-heading"><div><h1>Your week</h1><p>${days[0].toLocaleDateString('en-GB',{day:'numeric',month:'long'})} – ${days[6].toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p></div><div class="hub-actions"><button data-week-shift="-7" aria-label="Previous week">${HD_ICONS.svg('left')}</button><button data-current-week>This week</button><button data-week-shift="7" aria-label="Next week">${HD_ICONS.svg('right')}</button><a class="hub-link" href="#calendar">Month</a></div></div><div class="week-legend"><span>Events</span><span>Tasks &amp; care</span><span>Dinner</span></div>${agenda.complete?'':'<p role="status">Some recurring plans could not be loaded. Your saved events are shown.</p>'}<div class="week-grid">${days.map(day=>{
      const key=HD_CAL.ymd(day),events=eventsFor(key),due=tasksFor(key),meal=mealFor(key);
      return `<section class="week-day ${key===date?'selected':''}"><button class="week-date" data-week-date="${key}" aria-label="${day.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}" aria-pressed="${key===date}"><span>${day.toLocaleDateString('en-GB',{weekday:'short'})}</span><strong>${day.getDate()}</strong>${key===today()?'<small>Today</small>':'<small>&nbsp;</small>'}</button><div class="week-day-items">${events.slice(0,3).map(e=>`<button data-event-date="${key}" class="week-event">${esc(e.title)}</button>`).join('')}${events.length>3?`<button data-week-date="${key}" class="week-more">+${events.length-3} events</button>`:''}${due.slice(0,2).map(i=>`<button data-week-date="${key}" class="week-task">${esc(i.store==='plants'?'Water '+i.record.name:i.record.title)}</button>`).join('')}${due.length>2?`<button data-week-date="${key}" class="week-more">+${due.length-2} tasks</button>`:''}${!events.length&&!due.length?'<p class="week-open">Open day</p>':''}<button class="week-meal" data-plan-meal="${key}">${HD_ICONS.svg('kitchen')}<span>${meal?esc(meal.title):'Plan dinner'}</span></button></div></section>`;
    }).join('')}</div><div class="week-bottom"><section class="v3-surface"><div class="v3-section-heading"><h2>${HD_CAL.parseYMD(date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}</h2><button data-event-date="${date}">+ Event</button></div>${eventsFor(date).map(e=>`<button class="week-agenda-row" data-event-date="${date}">${HD_ICONS.svg('calendar')}<span>${esc(e.title)}</span>${HD_SETTINGS.personBadgeHtml(e.assignedTo||'Both')}</button>`).join('')}${tasksFor(date).map(HD_TODAY.row).join('')}${!eventsFor(date).length&&!tasksFor(date).length?'<p class="text-muted">No events or tasks due. Add an event or plan dinner.</p>':''}<div class="week-dinner-row"><span>Dinner · ${esc(mealFor(date)?.title||'Not planned')}</span><button data-plan-meal="${date}">Change</button></div></section><section class="v3-surface"><h2>Plan → shopping</h2><p class="text-muted">Bring this week’s recipe ingredients onto your shopping list.</p><button class="primary" data-review-ingredients>Review ingredients</button><a class="hub-inline-link" href="#shopping">Open shopping list</a><p class="v3-small">Chores show their next due date. Completing one schedules its next occurrence.</p></section></div>`;
    host.querySelectorAll('[data-week-shift]').forEach(b=>b.onclick=()=>{selected=HD_CAL.ymd(HD_CAL.addDays(HD_CAL.parseYMD(date),Number(b.dataset.weekShift)));HD_UI.refresh();});
    host.querySelector('[data-current-week]').onclick=()=>{selected=null;HD_UI.refresh();};
    host.querySelectorAll('[data-week-date]').forEach(b=>b.onclick=()=>{selected=b.dataset.weekDate;HD_UI.refresh();});
    host.querySelectorAll('[data-event-date]').forEach(b=>b.onclick=()=>HD_DASHBOARD.openEventModal(b.dataset.eventDate,HD_UI.refresh));
    host.querySelectorAll('[data-plan-meal]').forEach(b=>b.onclick=()=>HD_UI.run(()=>planMeal(b.dataset.planMeal)));
    host.querySelector('[data-review-ingredients]').onclick=()=>HD_UI.run(()=>reviewIngredients(HD_CAL.ymd(days[0]),end));
    HD_TODAY.attachRows(host,HD_UI.refresh);
  }
  window.HD_WEEK={render,planMeal,reviewIngredients,ingredientsForRange,addIngredients,taskItems};
})();
