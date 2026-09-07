(() => {
  let selectedDate = null, renderSequence = 0;
  const esc = value => HD_CAL.escapeHtml(String(value ?? ''));
  const today = () => HD_CAL.ymd(new Date());
  const chosenDate = () => selectedDate || today();
  const personMatches = record => HD_UI.getPerson() === 'Everyone' || !record.assignedTo || record.assignedTo === 'Both' || record.assignedTo === HD_UI.getPerson();
  const labelDate = key => key ? HD_CAL.parseYMD(key).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '';
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
      ${done?'':`<div class="v3-row-actions"><button data-later>Later</button>${store!=='plants'?'<button data-assign>Reassign</button>':''}</div>`}</div>`;
  }
  function attachRows(container, refresh) {
    container.querySelectorAll('.v3-task').forEach(el=>{
      const {store,id}=el.dataset;
      el.querySelector('[data-complete]').addEventListener('change',async event=>{
        event.target.disabled=true;
        await HD_UI.run(async()=>{
          const undo=await HD_ACTIONS.change(store,id,event.target.checked?'complete':'reopen');
          await refresh();
          HD_UI.toast(undo?'Saved.':'Already completed today.',undo ? async()=>{await HD_ACTIONS.undo(undo);await refresh();}:null);
        });
        if(el.isConnected)event.target.disabled=false;
      });
      el.querySelector('[data-edit]').onclick=async()=>{
        if(store==='plants'){location.hash='garden';return;}
        const record=await HD_DB.dbGet(store,id);
        HD_UI.quickAdd(store==='scheduling'?'chore':'task',record,refresh);
      };
      el.querySelector('[data-later]')?.addEventListener('click',()=>{
        const tomorrow=HD_CAL.ymd(HD_CAL.addDays(new Date(),1));
        const panel=HD_UI.dialog('Move to later',`<form id="later-form"><label>New due date<input type="date" name="date" value="${tomorrow}" min="${today()}" required></label><button class="primary" type="submit">Move task</button></form>`);
        panel.querySelector('form').onsubmit=event=>{event.preventDefault();HD_UI.run(async()=>{
          const undo=await HD_ACTIONS.change(store,id,'postpone',new FormData(event.target).get('date'));
          HD_UI.closeDialog();await refresh();HD_UI.toast('Moved to later.',async()=>{await HD_ACTIONS.undo(undo);await refresh();});
        });};
      });
      el.querySelector('[data-assign]')?.addEventListener('click',()=>{
        const panel=HD_UI.dialog('Who is taking this one?',`<form><label>Assigned to<select name="person">${HD_SETTINGS.assigneeOptionsHtml(el.dataset.person)}</select></label><button class="primary">Reassign</button></form>`);
        panel.querySelector('form').onsubmit=event=>{event.preventDefault();HD_UI.run(async()=>{
          const undo=await HD_ACTIONS.change(store,id,'assign',new FormData(event.target).get('person'));
          HD_UI.closeDialog();await refresh();HD_UI.toast('Reassigned.',async()=>{await HD_ACTIONS.undo(undo);await refresh();});
        });};
      });
    });
  }
  async function render(main,options={}) {
    const sequence=++renderSequence, data=await records();
    if(sequence!==renderSequence||!main.isConnected)return;
    const full=Boolean(options.full), type=options.type||'todo', date=chosenDate(), layout=HD_WORKSPACE.getLayout();
    let items=[...data.homeWork.map(record=>({record,store:'homeWork'})),...data.scheduling.filter(r=>r.category==='chore').map(record=>({record,store:'scheduling'})),...data.plants.map(record=>({record,store:'plants'}))]
      .map(item=>({...item,due:HD_ACTIONS.nextDue(item.store,item.record)})).filter(item=>personMatches(item.record));
    if(full) items=items.filter(item=>item.store===(type==='chores'?'scheduling':'homeWork'));
    else items=items.filter(item=>item.record.status!=='done' && item.due && item.due<=date);
    items.sort((a,b)=>Number(a.record.status==='done')-Number(b.record.status==='done')||(a.due||'9999').localeCompare(b.due||'9999')||a.record.title?.localeCompare(b.record.title||'')||0);
    const refresh=()=>HD_UI.refresh();
    if(full) {
      main.innerHTML=`<div class="v3-page-heading"><div><h1>Tasks</h1><p>A little progress, every day.</p></div><button class="primary" id="add-task">+ Add ${type==='chores'?'chore':'task'}</button></div><div class="v3-tabs"><button data-task-view="todo" class="${type==='todo'?'active':''}">To-do</button><button data-task-view="chores" class="${type==='chores'?'active':''}">Recurring chores</button><button data-task-view="plans">Recurring plans</button></div><section class="v3-surface">${items.length?items.map(row).join(''):'<div class="v3-empty"><h2>A fresh start.</h2><p>Add your first task and give it a home.</p></div>'}</section>`;
      main.querySelector('#add-task').onclick=()=>HD_UI.quickAdd(type==='chores'?'chore':'task');
      main.querySelectorAll('[data-task-view]').forEach(button=>button.onclick=()=>{location.hash=`tasks/${button.dataset.taskView}`;});
      attachRows(main,refresh);return;
    }
    const start=HD_CAL.startOfWeek(HD_CAL.parseYMD(date));
    const events=data.events.filter(e=>e.date<=date&&(e.endDate||e.date)>=date&&personMatches(e));
    const heading=date===today()?'Today':HD_CAL.parseYMD(date).toLocaleDateString('en-GB',{weekday:'long'});
    main.innerHTML=`<div class="v3-week" aria-label="Choose a day"><button class="v3-week-shift" aria-label="Previous week" data-shift="-7">‹</button>${Array.from({length:7},(_,i)=>{
      const d=HD_CAL.addDays(start,i),key=HD_CAL.ymd(d),count=data.events.filter(e=>e.date<=key&&(e.endDate||e.date)>=key).length;
      return `<button class="v3-day ${key===date?'selected':''}" data-date="${key}" aria-pressed="${key===date}"><span>${d.toLocaleDateString('en-GB',{weekday:'short'})}</span><strong>${d.getDate()}</strong><span class="v3-day-dot ${count?'has-event':''}" aria-label="${count} events"></span></button>`;
    }).join('')}<button class="v3-week-shift" aria-label="Next week" data-shift="7">›</button></div>
    <div class="v3-dashboard ${layout.preset==='focus'?'v3-focus':''}"><section class="v3-surface v3-priorities"><div class="v3-section-heading"><h1>${heading}</h1><button class="text-button" id="return-today">${date!==today()?'Back to today':'View calendar'}</button></div>
      ${layout.preset==='week'?'<div id="v3-week-calendar"></div>':''}
      <div class="v3-next">${events.length?`<span class="v3-next-label">On the agenda</span><button id="open-day">${esc(events[0].title)}${events.length>1?` <small>+${events.length-1} more</small>`:''}</button>`:`<span class="v3-next-label">A little breathing room</span><button id="open-day">No events planned. Add one?</button>`}</div>
      <div class="v3-section-subtitle"><span>${items.length?`${items.length} thing${items.length===1?'':'s'} to take care of`:'All clear for this day'}</span><button class="text-button" id="add-today">+ Add task</button></div>
      <div class="v3-tasks">${items.length?items.slice(0,8).map(row).join(''):'<div class="v3-empty"><div class="v3-empty-mark">✓</div><h2>Make room for a good day.</h2><p>Your tasks and watering reminders will appear here.</p><button id="first-task">Add a task</button></div>'}</div>
      ${items.length>8?'<a class="v3-all-link" href="#tasks">View all tasks</a>':''}
      <div class="v3-priorities-footer"><span>Small things. Shared effort.</span><a href="#stats">View progress <span aria-hidden="true">↗</span></a></div>
    </section><aside class="v3-widgets" aria-label="Your widgets">${layout.widgets.map(id=>`<section class="v3-surface v3-widget size-${layout.sizes[id]}" data-widget="${id}"></section>`).join('')}${layout.widgets.length===0?'<button id="empty-widgets">+ Add a widget</button>':''}</aside></div>`;
    main.querySelectorAll('[data-date]').forEach(button=>button.onclick=()=>{selectedDate=button.dataset.date;refresh();});
    main.querySelectorAll('[data-shift]').forEach(button=>button.onclick=()=>{selectedDate=HD_CAL.ymd(HD_CAL.addDays(HD_CAL.parseYMD(date),Number(button.dataset.shift)));refresh();});
    main.querySelector('#return-today').onclick=()=>{if(date!==today()){selectedDate=null;refresh();}else location.hash='calendar';};
    main.querySelector('#open-day').onclick=()=>HD_DASHBOARD.openEventModal(date,refresh);
    main.querySelector('#add-today').onclick=()=>HD_UI.quickAdd('task');
    main.querySelector('#first-task')?.addEventListener('click',()=>HD_UI.quickAdd('task'));
    main.querySelector('#empty-widgets')?.addEventListener('click',HD_UI.editLayout);
    if(layout.preset==='week'){HD_CAL.CAL_STATE.mode='week';HD_CAL.renderCalendar(main.querySelector('#v3-week-calendar'),key=>HD_DASHBOARD.openEventModal(key,refresh));}
    attachRows(main,refresh);
    for(const element of main.querySelectorAll('[data-widget]')) await renderWidget(element,element.dataset.widget,data,refresh);
  }
  async function renderWidget(el,id,data,refresh) {
    const heading=(title,route)=>`<div class="v3-widget-heading"><h2>${title}</h2>${route?`<a href="#${route}" aria-label="Open ${title}">↗</a>`:''}</div>`;
    if(id==='shopping'){
      const items=data.shoppingItems.filter(i=>!i.checked),limit=HD_WORKSPACE.getLayout().sizes[id]==='compact'?3:5;
      el.innerHTML=heading('Shopping','shopping')+(items.length?items.slice(0,limit).map(i=>`<label class="v3-shopping-item"><input type="checkbox" data-shop="${esc(i.id)}"><span>${esc(i.item)}</span><small>${esc(i.qty)}</small></label>`).join(''):'<p class="text-muted">A fresh list for your next shop.</p>')+`<button class="v3-wide-button" data-add-shopping>+ Add item</button>${items.length>limit?`<a class="v3-all-link" href="#shopping">${items.length-limit} more items</a>`:''}`;
      el.querySelector('[data-add-shopping]').onclick=()=>HD_UI.quickAdd('shopping');
      el.querySelectorAll('[data-shop]').forEach(cb=>cb.onchange=()=>HD_UI.run(async()=>{const undo=await HD_ACTIONS.change('shoppingItems',cb.dataset.shop,'check',true);await refresh();HD_UI.toast('Added to purchased.',async()=>{await HD_ACTIONS.undo(undo);await refresh();});}));
    }else if(id==='meals'){
      const plan=data.mealPlans.find(p=>p.date===chosenDate()),recipe=plan&&data.recipes.find(r=>r.id===plan.recipeId);
      el.innerHTML=heading('Tonight','recipes')+`<p class="v3-meal-title">${recipe?esc(recipe.title):'What sounds good?'}</p><p class="text-muted">${recipe?'Dinner is on the plan.':'Choose something from your saved recipes.'}</p><button class="v3-wide-button" data-meal>${recipe?'Change dinner':'Plan dinner'}</button>`;
      el.querySelector('[data-meal]').onclick=()=>{
        if(!data.recipes.length){location.hash='recipes';return;}
        const panel=HD_UI.dialog('Plan dinner',`<form><label>Recipe<select name="recipe"><option value="">No meal planned</option>${data.recipes.map(r=>`<option value="${esc(r.id)}" ${recipe?.id===r.id?'selected':''}>${esc(r.title)}</option>`).join('')}</select></label><button class="primary">Save dinner</button></form>`);
        panel.querySelector('form').onsubmit=e=>{e.preventDefault();HD_UI.run(async()=>{const recipeId=new FormData(e.target).get('recipe'),date=chosenDate();if(recipeId)await HD_DB.dbPut('mealPlans',{id:date,date,recipeId,createdAt:Date.now()});else await HD_DB.dbDelete('mealPlans',date);HD_UI.closeDialog();refresh();});};
      };
    }else if(id==='garden'){
      const due=data.plants.filter(p=>HD_ACTIONS.nextDue('plants',p)<=chosenDate());
      el.innerHTML=heading('Garden','garden')+`<p class="v3-meal-title">${due.length?`${due.length} plant${due.length===1?'':'s'} need a drink`:'A little greener, every day.'}</p><p class="text-muted">${due.length?due.slice(0,3).map(p=>esc(p.name)).join(', '):data.plants.length?'Your watering is up to date.':'Add your plants and their care routine.'}</p><a class="v3-wide-button" href="#garden">Open garden</a>`;
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
  window.HD_TODAY={render,renderWidget,records,chosenDate};
})();
