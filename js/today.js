(() => {
  let selectedDate = null, renderSequence = 0;
  const icon = name => HD_ICONS.svg(name);
  const esc = value => HD_CAL.escapeHtml(String(value ?? ''));
  const today = () => HD_CAL.ymd(new Date());
  const chosenDate = () => selectedDate || today();
  const personMatches = record => HD_UI.getPerson() === 'Everyone' || !record.assignedTo || record.assignedTo === 'Both' || record.assignedTo === HD_UI.getPerson();
  const labelDate = key => key ? HD_CAL.parseYMD(key).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '';
  function agendaItemsOnDate(items,date,person='Everyone') {
    return items.filter(item=>item.date<=date && (item.endDate||item.date)>=date
      && !item.isCompletedRecord && !['chore','plant'].includes(item.category) && item.type!=='plant'
      && (person==='Everyone'||!item.assignedTo||item.assignedTo==='Both'||item.assignedTo===person));
  }
  async function agendaForWeek(data,date) {
    const start=HD_CAL.startOfWeek(HD_CAL.parseYMD(date)),end=HD_CAL.addDays(start,6);
    try {
      // Reuse Calendar's recurrence enumerator; chores remain in the task list.
      const plans=await HD_SCHEDULING.getScheduleItemsInRange(start,end);
      return {start,items:[...data.events,...plans],complete:true};
    } catch {
      return {start,items:data.events,complete:false};
    }
  }
  async function records() {
    const names=['homeWork','scheduling','plants','events','shoppingItems','recipes','mealPlans','notes','completions'];
    return Object.fromEntries(await Promise.all(names.map(async name => [name, await HD_DB.dbGetAll(name)])));
  }
  function row(item) {
    const {record:r,store,due}=item, done = store==='homeWork' && r.status==='done';
    const title = store==='plants' ? `Water ${r.name}` : r.title;
    const dueLabel = !due ? 'No due date' : due < today() && !done ? 'Overdue' : due === today() ? 'Due today' : `Due ${labelDate(due)}`;
    return `<div class="v3-task ${done?'is-done':''}" data-store="${store}" data-id="${esc(r.id)}" data-person="${esc(r.assignedTo||'Both')}">
      <label class="v3-check-hit"><input class="v3-check" type="checkbox" aria-label="${done?'Reopen':'Complete'} ${esc(title)}" data-complete ${done?'checked':''}></label>
      <div class="v3-task-copy"><button class="v3-task-title" data-edit>${esc(title)}</button><div class="v3-meta">${HD_SETTINGS.personBadgeHtml(r.assignedTo||'Both')}<span class="${due<today()&&!done?'v3-overdue':''}">${esc(done?'Completed':dueLabel)}</span></div></div>
      ${done?'':`<div class="v3-row-actions"><button data-later>Later</button><button class="icon-button" data-options aria-label="Options for ${esc(title)}">${icon('more')}</button></div>`}</div>`;
  }
  function attachRows(container, refresh) {
    container.querySelectorAll('.v3-task').forEach(el=>{
      const {store,id}=el.dataset;
      const focusRow=()=>{const rows=[...container.querySelectorAll('.v3-task')],target=rows.find(row=>row.dataset.id===id&&row.dataset.store===store)||rows[0];(target?.querySelector('[data-complete]')||container.querySelector('#add-today,#add-task'))?.focus();};
      el.querySelector('[data-complete]').addEventListener('change',async event=>{
        event.target.disabled=true;
        const wasChecked=!event.target.checked;
        await HD_UI.run(async()=>{
          let undo;
          try{undo=await HD_ACTIONS.change(store,id,event.target.checked?'complete':'reopen');}
          catch(error){event.target.checked=wasChecked;throw error;}
          await refresh();focusRow();
          HD_UI.toast(undo?(wasChecked?'Task reopened.':'Task completed.'):'Already completed today.',undo ? async()=>{await HD_ACTIONS.undo(undo);await refresh();focusRow();}:null);
        });
        if(el.isConnected)event.target.disabled=false;
      });
      el.querySelector('[data-edit]').onclick=async()=>{
        if(store==='plants'){location.hash='garden';return;}
        const record=await HD_DB.dbGet(store,id);
        HD_UI.quickAdd(store==='scheduling'?'chore':'task',record,refresh);
      };
      el.querySelector('[data-later]')?.addEventListener('click',async()=>{
        const record=await HD_DB.dbGet(store,id),due=HD_ACTIONS.nextDue(store,record);
        const tomorrow=HD_CAL.ymd(HD_CAL.addDays(HD_CAL.parseYMD(due>today()?due:today()),1));
        const panel=HD_UI.dialog('Move to later',`<form id="later-form"><label>New due date<input type="date" name="date" value="${tomorrow}" min="${today()}" required></label><button class="primary" type="submit">Move task</button></form>`);
        panel.querySelector('form').onsubmit=event=>{event.preventDefault();HD_UI.run(async()=>{
          const newDate=new FormData(event.target).get('date'),undo=await HD_ACTIONS.change(store,id,'postpone',newDate);
          HD_UI.closeDialog();await refresh();HD_UI.toast(`Moved to ${labelDate(newDate)}.`,async()=>{await HD_ACTIONS.undo(undo);await refresh();});
        });};
      });
      const reassign=()=>{
        const panel=HD_UI.dialog('Who is taking this one?',`<form><label>Assigned to<select name="person">${HD_SETTINGS.assigneeOptionsHtml(el.dataset.person)}</select></label><button class="primary">Reassign</button></form>`);
        panel.querySelector('form').onsubmit=event=>{event.preventDefault();HD_UI.run(async()=>{
          const undo=await HD_ACTIONS.change(store,id,'assign',new FormData(event.target).get('person'));
          HD_UI.closeDialog();await refresh();HD_UI.toast('Reassigned.',async()=>{await HD_ACTIONS.undo(undo);await refresh();});
        });};
      };
      el.querySelector('[data-options]')?.addEventListener('click',()=>{
        const panel=HD_UI.dialog('Task options',`<div class="v3-add-menu"><button data-option-edit>${store==='plants'?'Open in Garden':'Edit task'}${icon('edit')}</button>${store!=='plants'?'<button data-option-assign>Reassign'+icon('people')+'</button>':''}</div>`);
        panel.querySelector('[data-option-edit]').onclick=()=>{HD_UI.closeDialog();el.querySelector('[data-edit]').click();};
        panel.querySelector('[data-option-assign]')?.addEventListener('click',reassign);
      });
    });
  }
  async function render(main,options={}) {
    const sequence=++renderSequence,route=main.dataset.route,data=await records();
    if(sequence!==renderSequence||!main.isConnected||main.dataset.route!==route)return;
    const full=Boolean(options.full), type=options.type||'todo', date=chosenDate(), layout=HD_WORKSPACE.getLayout();
    let items=[...data.homeWork.map(record=>({record,store:'homeWork'})),...data.scheduling.filter(r=>r.category==='chore').map(record=>({record,store:'scheduling'})),...data.plants.map(record=>({record,store:'plants'}))]
      .map(item=>({...item,due:HD_ACTIONS.nextDue(item.store,item.record)})).filter(item=>personMatches(item.record));
    if(full && type!=='all') items=items.filter(item=>item.store===(type==='chores'?'scheduling':'homeWork'));
    else if(!full) items=items.filter(item=>item.record.status!=='done' && item.due && item.due<=date);
    items.sort((a,b)=>Number(a.record.status==='done')-Number(b.record.status==='done')||(a.due||'9999').localeCompare(b.due||'9999')||a.record.title?.localeCompare(b.record.title||'')||0);
    const refresh=()=>HD_UI.refresh();
    if(full) {
      main.innerHTML=`<div class="v3-page-heading"><p class="text-muted">${type==='all'?'To-dos, chores and plant care. All together.':type==='chores'?'The routines that keep home running.':'One thing at a time.'}</p><button class="primary" id="add-task">+ Add ${type==='chores'?'chore':'task'}</button></div><div class="v3-tabs"><button data-task-view="all" class="${type==='all'?'active':''}" aria-pressed="${type==='all'}">All</button><button data-task-view="todo" class="${type==='todo'?'active':''}" aria-pressed="${type==='todo'}">To-do</button><button data-task-view="chores" class="${type==='chores'?'active':''}" aria-pressed="${type==='chores'}">Recurring chores</button><button data-task-view="plans">Recurring plans</button></div><section class="v3-surface">${items.length?items.map(row).join(''):'<div class="v3-empty"><h2>A fresh start.</h2><p>Add your first task and give it a home.</p></div>'}</section>`;
      main.querySelector('#add-task').onclick=()=>HD_UI.quickAdd(type==='chores'?'chore':'task');
      main.querySelectorAll('[data-task-view]').forEach(button=>button.onclick=()=>{location.hash=`tasks/${button.dataset.taskView}`;});
      attachRows(main,refresh);return;
    }
    const agenda=await agendaForWeek(data,date),start=agenda.start;
    if(sequence!==renderSequence||!main.isConnected||main.dataset.route!==route)return;
    const events=agendaItemsOnDate(agenda.items,date,HD_UI.getPerson());
    const heading=date===today()?'Today':HD_CAL.parseYMD(date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});
    document.getElementById('workspace-title').textContent=heading;
    const completed=new Set(data.completions.filter(r=>r.date===date&&(HD_UI.getPerson()==='Everyone'||r.person===HD_UI.getPerson())).map(r=>`${r.itemType}:${r.itemId}`)).size;
    const total=items.length+completed;
    main.innerHTML=`<div class="v3-week" aria-label="Choose a day"><button class="v3-week-shift" aria-label="Previous week" data-shift="-7">${icon('left')}</button>${Array.from({length:7},(_,i)=>{
      const d=HD_CAL.addDays(start,i),key=HD_CAL.ymd(d),count=agendaItemsOnDate(agenda.items,key,HD_UI.getPerson()).length;
      const dateLabel=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      return `<button class="v3-day ${key===date?'selected':''}" data-date="${key}" aria-pressed="${key===date}" aria-label="${esc(dateLabel)}, ${count} event${count===1?'':'s'}"><span>${d.toLocaleDateString('en-GB',{weekday:'short'})}</span><strong>${d.getDate()}</strong><span class="v3-day-dot ${count?'has-event':''}" aria-hidden="true"></span></button>`;
    }).join('')}<button class="v3-week-shift" aria-label="Next week" data-shift="7">${icon('right')}</button></div>
    <div class="v3-dashboard ${layout.preset==='focus'?'v3-focus':''}"><div class="v3-primary-column">
      <section class="v3-next" aria-label="Your agenda">${icon('calendar')}<div class="v3-next-copy"><span class="v3-next-label">${agenda.complete?(events.length?'On the agenda':'A little breathing room'):'Agenda partly loaded'}</span><button id="open-day">${events.length?esc(events[0].title):agenda.complete?'Nothing scheduled':'Agenda unavailable'}</button><p>${events.length?events.length>1?`${events.length-1} more event${events.length===2?'':'s'} this day · Tap to view`:'Tap to view your day':agenda.complete?'Keep it open, or make a plan.':'Recurring plans could not be loaded. Tap to view.'}</p></div><button class="v3-next-arrow" id="agenda-arrow" aria-label="Open this day">${icon('arrow')}</button></section>
      ${layout.preset==='week'?'<section class="v3-surface" id="v3-week-calendar"></section>':''}
      <section class="v3-surface v3-priorities"><div class="v3-section-heading"><div><h2>On the list</h2><span class="v3-task-count">${items.length?`${items.length} to do`:'All clear for this day'}</span></div>${total?`<div class="v3-progress"><span>${completed} of ${total} done</span><progress value="${completed}" max="${total}" aria-label="Daily task progress"></progress></div>`:''}</div>
      <div class="v3-tasks">${items.length?items.slice(0,6).map(row).join(''):'<div class="v3-empty"><div class="v3-empty-mark">'+icon('check')+'</div><h2>A little space in your day.</h2><p>Tasks and watering reminders will appear here.</p><button id="first-task">Add your first task</button></div>'}</div>
      <div class="v3-priorities-footer"><button class="text-button" id="add-today">${icon('plus')} Add task</button><a href="#tasks/all">View all tasks ${icon('arrow')}</a></div>
    </section><div class="v3-day-footer"><button class="text-button" id="return-today">${date!==today()?'Back to today':'Open full calendar'} ${icon('arrow')}</button></div></div>
    <aside class="v3-widgets" aria-label="Your widgets">${layout.widgets.map(id=>`<section class="v3-surface v3-widget size-${layout.sizes[id]}" data-widget="${id}"></section>`).join('')}${layout.widgets.length===0?'<button id="empty-widgets">+ Add a widget</button>':''}</aside></div>`;
    main.querySelectorAll('[data-date]').forEach(button=>button.onclick=()=>{selectedDate=button.dataset.date;refresh();});
    main.querySelectorAll('[data-shift]').forEach(button=>button.onclick=()=>{selectedDate=HD_CAL.ymd(HD_CAL.addDays(HD_CAL.parseYMD(date),Number(button.dataset.shift)));refresh();});
    main.querySelector('#return-today').onclick=()=>{if(date!==today()){selectedDate=null;refresh();}else location.hash='calendar';};
    main.querySelector('#open-day').onclick=()=>HD_DASHBOARD.openEventModal(date,refresh);
    main.querySelector('#agenda-arrow').onclick=()=>HD_DASHBOARD.openEventModal(date,refresh);
    main.querySelector('#add-today').onclick=()=>HD_UI.quickAdd('task');
    main.querySelector('#first-task')?.addEventListener('click',()=>HD_UI.quickAdd('task'));
    main.querySelector('#empty-widgets')?.addEventListener('click',HD_UI.editLayout);
    if(layout.preset==='week'){HD_CAL.CAL_STATE.mode='week';HD_CAL.CAL_STATE.refDate=HD_CAL.parseYMD(date);HD_CAL.renderCalendar(main.querySelector('#v3-week-calendar'),key=>HD_DASHBOARD.openEventModal(key,refresh));}
    attachRows(main,refresh);
    for(const element of main.querySelectorAll('[data-widget]')) await renderWidget(element,element.dataset.widget,data,refresh);
  }
  async function renderWidget(el,id,data,refresh) {
    const heading=(title,route)=>`${['meals','garden'].includes(id)?'<div class="v3-widget-symbol">'+icon(id==='meals'?'kitchen':'garden')+'</div>':''}<div class="v3-widget-heading"><h2>${id==='shopping'?icon('shopping'):''}${title}</h2>${route&&!['meals','garden'].includes(id)?`<a href="#${route}" aria-label="Open ${title}">${id==='shopping'?'<span>View list</span>':''}${icon('arrow')}</a>`:''}</div>`;
    if(id==='shopping'){
      const items=data.shoppingItems.filter(i=>!i.checked),limit=HD_WORKSPACE.getLayout().sizes[id]==='wide'?5:3;
      el.innerHTML=heading('Shopping','shopping')+(items.length?items.slice(0,limit).map(i=>`<label class="v3-shopping-item"><input class="v3-check" type="checkbox" data-shop="${esc(i.id)}" aria-label="Mark ${esc(i.item)} as purchased"><span class="v3-shopping-copy"><span>${esc(i.item)}</span>${i.qty?`<small>${esc(i.qty)}</small>`:""}</span></label>`).join(''):'<p class="text-muted">A fresh list for your next shop.</p>')+`<button class="v3-wide-button" data-add-shopping>${icon('plus')} Add item</button>${items.length>limit?`<a class="v3-all-link" href="#shopping">${items.length-limit} more items</a>`:''}`;
      el.querySelector('[data-add-shopping]').onclick=()=>HD_UI.quickAdd('shopping');
      el.querySelectorAll('[data-shop]').forEach(cb=>cb.onchange=()=>HD_UI.run(async()=>{cb.disabled=true;try{const undo=await HD_ACTIONS.change('shoppingItems',cb.dataset.shop,'check',true);await refresh();HD_UI.toast('Added to purchased.',async()=>{await HD_ACTIONS.undo(undo);await refresh();});}catch(error){cb.checked=false;throw error;}finally{if(cb.isConnected)cb.disabled=false;}}));
    }else if(id==='meals'){
      const plan=data.mealPlans.find(p=>p.date===chosenDate()),recipe=plan&&data.recipes.find(r=>r.id===plan.recipeId);
      el.innerHTML=heading(chosenDate()===today()?'Tonight':'Dinner','recipes')+`<p class="v3-meal-title">${recipe?esc(recipe.title):'What sounds good?'}</p><p class="text-muted">${chosenDate()!==today()?esc(labelDate(chosenDate()))+' · ':''}${recipe?'Dinner is on the plan.':'Pick a favourite for dinner.'}</p><button class="v3-wide-button" data-meal>${recipe?'Change dinner':'Plan dinner'}</button>`;
      el.querySelector('[data-meal]').onclick=()=>{
        if(!data.recipes.length){location.hash='recipes';return;}
        const panel=HD_UI.dialog('Plan dinner',`<form><label>Recipe<select name="recipe"><option value="">No meal planned</option>${data.recipes.map(r=>`<option value="${esc(r.id)}" ${recipe?.id===r.id?'selected':''}>${esc(r.title)}</option>`).join('')}</select></label><button class="primary">Save dinner</button></form>`);
        panel.querySelector('form').onsubmit=e=>{e.preventDefault();HD_UI.run(async()=>{const recipeId=new FormData(e.target).get('recipe'),date=chosenDate();if(recipeId)await HD_DB.dbPut('mealPlans',{id:date,date,recipeId,createdAt:Date.now()});else await HD_DB.dbDelete('mealPlans',date);HD_UI.closeDialog();refresh();});};
      };
    }else if(id==='garden'){
      const due=data.plants.filter(p=>HD_ACTIONS.nextDue('plants',p)<=chosenDate());
      el.innerHTML=heading('Garden','garden')+`<p class="v3-meal-title">${due.length?`${due.length} plant${due.length===1?'':'s'} need a drink`:data.plants.length?'All watered':'Make room for green'}</p><p class="text-muted">${due.length?due.slice(0,3).map(p=>esc(p.name)).join(', '):data.plants.length?'Your watering is up to date.':'Keep your plants happy, together.'}</p><a class="v3-wide-button" href="#garden">Open garden</a>`;
    }else if(id==='notes'){
      el.innerHTML=heading('Notes','notes')+data.notes.slice(0,3).map(n=>`<p class="v3-note">${esc(n.text.slice(0,180))}</p>`).join('')+'<button class="v3-wide-button" data-note>+ Add note</button>';
      el.querySelector('[data-note]').onclick=()=>HD_UI.quickAdd('note');
    }else if(id==='trip'){
      el.innerHTML=heading('Next trip','calendar')+'<div data-trip></div>';await HD_DASHBOARD.renderTripCountdown(el.querySelector('[data-trip]'));
    }else if(id==='goals')await HD_GOAL.renderGoalCard(el);
    else if(id==='activities')await HD_ACTIVITIES.renderActivitiesCard(el);
    else if(id==='stats'){
      const totals=await HD_POINTS.getLeaderboard();if(!el.isConnected)return;
      el.innerHTML=heading('Shared progress','stats')+Object.entries(totals).map(([name,points])=>`<div class="v3-score">${HD_SETTINGS.personBadgeHtml(name)}<strong>${points} <small>pts</small></strong></div>`).join('');
    }else if(id==='decide'){
      el.innerHTML=heading('A little help choosing')+'<p class="text-muted">Dinner, a task, or your next adventure.</p><button class="v3-wide-button" data-decide>Help me decide</button>';el.querySelector('button').onclick=()=>HD_DECIDE.openDecideModal();
    }else if(id==='music'){
      const url=HD_SETTINGS.spotifyEmbedUrl(HD_SETTINGS.getSettings().spotifyUrl);
      el.innerHTML=heading('Music','settings')+(url?`<iframe title="Spotify player" src="${esc(url)}" width="100%" height="152" loading="lazy" allow="encrypted-media"></iframe>`:'<p class="text-muted">Add a Spotify link in Settings.</p>');
    }else if(id==='weather'){
      el.innerHTML=heading('Weather')+'<p class="text-muted">Use your location to see the weather.</p><button class="v3-wide-button" data-weather>Load weather</button>';
      el.querySelector('button').onclick=()=>renderWeatherWidget(el);
    }
  }
  window.HD_TODAY={render,renderWidget,records,chosenDate,agendaItemsOnDate,agendaForWeek,row,attachRows};
})();
