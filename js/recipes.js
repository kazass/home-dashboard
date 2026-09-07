let recipesSubView = 'recipes';
let recipePhotoUrls = [];

function cleanupPhotoUrls() {
  recipePhotoUrls.forEach((url) => URL.revokeObjectURL(url));
  recipePhotoUrls = [];
}

function recipePhotoSrc(recipe) {
  if (recipe.photoBlob) {
    const url = URL.createObjectURL(recipe.photoBlob);
    recipePhotoUrls.push(url);
    return url;
  }
  if (recipe.photoUrl) return HD_SETTINGS.safeExternalUrl(recipe.photoUrl);
  return null;
}

function starsHtml(recipeId, person, rating) {
  const safeId = HD_CAL.escapeHtml(recipeId);
  const safePerson = HD_CAL.escapeHtml(person);
  return `<div class="stars" data-person="${safePerson}">
    ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star ${n <= (rating || 0) ? 'filled' : ''}" data-recipe="${safeId}" data-person="${safePerson}" data-rate="${n}">★</button>`).join('')}
  </div>`;
}

async function renderRecipesTab(main) {
  main.innerHTML = `
    <div class="tab-header">
      <h2>Recipes</h2>
      <div class="sub-nav">
        <button type="button" class="sub-nav-btn" data-sub="recipes">Recipes</button>
        <button type="button" class="sub-nav-btn" data-sub="mealplan">Meal Plan</button>
      </div>
    </div>
    <div id="recipes-content"></div>`;

  main.querySelectorAll('[data-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      recipesSubView = btn.dataset.sub;
      renderSubView();
    });
  });

  function renderSubView() {
    main.querySelectorAll('[data-sub]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sub === recipesSubView);
    });
    const content = document.getElementById('recipes-content');
    if (recipesSubView === 'mealplan') {
      cleanupPhotoUrls();
      renderMealPlanView(content);
    } else {
      renderRecipeListView(content);
    }
  }

  renderSubView();
}

async function renderRecipeListView(content) {
  content.innerHTML = `
    <form id="recipe-form" class="inline-form">
      <input name="title" placeholder="Recipe title" required>
      <input type="file" name="photoFile" accept="image/*">
      <input name="photoUrl" placeholder="...or paste an image URL">
      <input name="tags" placeholder="Tags (optional, comma-separated)">
      <input name="sourceUrl" placeholder="Source link (optional)">
      <textarea name="ingredients" placeholder="Ingredients — one per line"></textarea>
      <textarea name="steps" placeholder="Steps / instructions"></textarea>
      <button type="submit">Add recipe</button>
    </form>
    <div id="recipe-list" class="plant-grid"></div>`;

  const listEl = document.getElementById('recipe-list');
  let editingId = null;

  function editFormHtml(r) {
    return `
      <form class="item-edit-form plant-body" data-edit-form="${r.id}">
        <input name="title" value="${HD_CAL.escapeHtml(r.title)}" required>
        <input type="file" name="photoFile" accept="image/*">
        <input name="photoUrl" value="${HD_CAL.escapeHtml(r.photoUrl || '')}" placeholder="...or paste an image URL">
        <input name="tags" value="${HD_CAL.escapeHtml(r.tags || '')}" placeholder="Tags (optional, comma-separated)">
        <input name="sourceUrl" value="${HD_CAL.escapeHtml(r.sourceUrl || '')}" placeholder="Source link (optional)">
        <textarea name="ingredients" placeholder="Ingredients — one per line">${HD_CAL.escapeHtml(r.ingredients || '')}</textarea>
        <textarea name="steps" placeholder="Steps / instructions">${HD_CAL.escapeHtml(r.steps || '')}</textarea>
        <div class="modal-form-actions">
          <button type="button" data-cancel-edit>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>`;
  }

  async function refresh() {
    const recipes = await HD_DB.dbGetAll('recipes');
    recipes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cleanupPhotoUrls();

    listEl.innerHTML = recipes.length
      ? recipes.map((r) => {
        if (r.id === editingId) return `<div class="plant-card" data-id="${r.id}">${editFormHtml(r)}</div>`;
        const src = recipePhotoSrc(r);
        const sourceUrl = HD_SETTINGS.safeExternalUrl(r.sourceUrl);
        const tags = (r.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
        return `
        <div class="plant-card" data-id="${r.id}">
          ${src ? `<img class="plant-photo" src="${HD_CAL.escapeHtml(src)}" alt="${HD_CAL.escapeHtml(r.title)}">` : '<div class="plant-photo plant-photo-empty">No photo</div>'}
          <div class="plant-body">
            <div class="task-row-main">
              <span class="task-title">${HD_CAL.escapeHtml(r.title)}</span>
              ${tags.map((t) => `<span class="badge tag">${HD_CAL.escapeHtml(t)}</span>`).join('')}
            </div>
            ${HD_SETTINGS.getUserNames().map((p) => `
              <div class="rating-row">
                <span class="text-muted">${HD_CAL.escapeHtml(p)}</span>
                ${starsHtml(r.id, p, (r.ratings || {})[p])}
              </div>`).join('')}
            <details>
              <summary>Ingredients &amp; steps</summary>
              <div class="task-notes text-muted"><strong>Ingredients:</strong><br>${HD_CAL.escapeHtml(r.ingredients || '').replace(/\n/g, '<br>')}</div>
              <div class="task-notes text-muted"><strong>Steps:</strong><br>${HD_CAL.escapeHtml(r.steps || '').replace(/\n/g, '<br>')}</div>
            </details>
            ${sourceUrl ? `<div><a href="${HD_CAL.escapeHtml(sourceUrl)}" target="_blank" rel="noopener">Source</a></div>` : ''}
            <div class="task-actions">
              <button type="button" data-edit="${r.id}">Edit</button>
              <button type="button" data-delete="${r.id}">Delete</button>
            </div>
          </div>
        </div>`;
      }).join('')
      : '<p class="text-muted">No recipes yet.</p>';

    listEl.querySelectorAll('.star').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const recipe = recipes.find((r) => r.id === btn.dataset.recipe);
        const person = btn.dataset.person;
        const n = Number(btn.dataset.rate);
        recipe.ratings = recipe.ratings || {};
        recipe.ratings[person] = recipe.ratings[person] === n ? 0 : n;
        await HD_DB.dbPut('recipes', recipe);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this recipe?')) return;
        await HD_DB.dbDelete('recipes', btn.dataset.delete);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingId = btn.dataset.edit;
        refresh();
      });
    });

    listEl.querySelectorAll('[data-cancel-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingId = null;
        refresh();
      });
    });

    listEl.querySelectorAll('[data-edit-form]').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const id = form.dataset.editForm;
        const recipe = recipes.find((r) => r.id === id);
        const fd = new FormData(form);
        const title = fd.get('title').trim();
        if (!title) return;

        const rawSourceUrl = fd.get('sourceUrl').trim();
        const safeSourceUrl = HD_SETTINGS.safeExternalUrl(rawSourceUrl);
        if (rawSourceUrl && !safeSourceUrl) {
          alert('Source link must start with http:// or https://.');
          return;
        }

        const file = fd.get('photoFile');
        if (file && file.size > 0) {
          recipe.photoBlob = await HD_GARDEN.compressImage(file);
          recipe.photoUrl = '';
        } else {
          const newUrl = fd.get('photoUrl').trim();
          const safePhotoUrl = HD_SETTINGS.safeExternalUrl(newUrl);
          if (newUrl && !safePhotoUrl) {
            alert('Photo link must start with http:// or https://.');
            return;
          }
          if (newUrl !== (recipe.photoUrl || '')) {
            recipe.photoUrl = safePhotoUrl || '';
            recipe.photoBlob = null;
          }
        }

        recipe.title = title;
        recipe.tags = fd.get('tags').trim();
        recipe.sourceUrl = safeSourceUrl || '';
        recipe.ingredients = fd.get('ingredients').trim();
        recipe.steps = fd.get('steps').trim();
        await HD_DB.dbPut('recipes', recipe);
        editingId = null;
        refresh();
      });
    });
  }

  document.getElementById('recipe-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const title = fd.get('title').trim();
    if (!title) return;

    const rawPhotoUrl = fd.get('photoUrl').trim();
    const safePhotoUrl = HD_SETTINGS.safeExternalUrl(rawPhotoUrl);
    const rawSourceUrl = fd.get('sourceUrl').trim();
    const safeSourceUrl = HD_SETTINGS.safeExternalUrl(rawSourceUrl);
    if ((rawPhotoUrl && !safePhotoUrl) || (rawSourceUrl && !safeSourceUrl)) {
      alert('Photo and source links must start with http:// or https://.');
      return;
    }

    const file = fd.get('photoFile');
    let photoBlob = null;
    if (file && file.size > 0) {
      photoBlob = await HD_GARDEN.compressImage(file);
    }

    await HD_DB.dbPut('recipes', {
      id: crypto.randomUUID(),
      title,
      photoBlob,
      photoUrl: photoBlob ? '' : (safePhotoUrl || ''),
      tags: fd.get('tags').trim(),
      sourceUrl: safeSourceUrl || '',
      ingredients: fd.get('ingredients').trim(),
      steps: fd.get('steps').trim(),
      ratings: {},
      createdAt: Date.now(),
    });
    ev.target.reset();
    refresh();
  });

  refresh();
}

const mealPlanState = { refDate: new Date() };

async function renderMealPlanView(content) {
  const weekStart = HD_CAL.startOfWeek(mealPlanState.refDate);
  const days = Array.from({ length: 7 }, (_, i) => HD_CAL.addDays(weekStart, i));
  const weekEnd = days[6];
  const recipes = await HD_DB.dbGetAll('recipes');
  const plans = await HD_DB.dbGetAll('mealPlans');
  const planByDate = new Map(plans.map((p) => [p.date, p]));

  content.innerHTML = `
    <div class="cal-toolbar">
      <div class="cal-toolbar-nav">
        <button class="cal-nav-btn" data-mp-nav="prev">&lt;</button>
        <h3>Week of ${HD_CAL.ymd(weekStart)}</h3>
        <button class="cal-nav-btn" data-mp-nav="next">&gt;</button>
      </div>
      <button class="cal-nav-btn" data-mp-nav="today">This week</button>
    </div>
    <div class="mealplan-grid">
      ${days.map((d) => {
        const key = HD_CAL.ymd(d);
        const plan = planByDate.get(key);
        return `
        <div class="mealplan-day">
          <div class="mealplan-day-label">${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}</div>
          <select data-plan-date="${key}">
            <option value="">— none —</option>
            ${recipes.map((r) => `<option value="${r.id}" ${plan && plan.recipeId === r.id ? 'selected' : ''}>${HD_CAL.escapeHtml(r.title)}</option>`).join('')}
          </select>
        </div>`;
      }).join('')}
    </div>
    <div class="mealplan-actions">
      <button type="button" id="add-missing-btn">Add missing ingredients to Shopping list</button>
      <span id="add-missing-result" class="text-muted"></span>
    </div>`;

  content.querySelectorAll('[data-mp-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.mpNav;
      if (nav === 'today') mealPlanState.refDate = new Date();
      else mealPlanState.refDate = HD_CAL.addDays(mealPlanState.refDate, (nav === 'next' ? 1 : -1) * 7);
      renderMealPlanView(content);
    });
  });

  content.querySelectorAll('[data-plan-date]').forEach((select) => {
    select.addEventListener('change', async () => {
      const date = select.dataset.planDate;
      if (select.value) {
        await HD_DB.dbPut('mealPlans', { id: date, date, recipeId: select.value, createdAt: Date.now() });
      } else {
        await HD_DB.dbDelete('mealPlans', date);
      }
    });
  });

  document.getElementById('add-missing-btn').addEventListener('click', async () => {
    const added = await addMissingIngredientsForRange(weekStart, weekEnd);
    document.getElementById('add-missing-result').textContent = added === 0
      ? 'Nothing new — shopping list already covers it.'
      : `Added ${added} item${added === 1 ? '' : 's'} to the shopping list.`;
  });
}

async function addMissingIngredientsForRange(rangeStart, rangeEnd) {
  const plans = await HD_DB.dbGetAll('mealPlans');
  const recipes = await HD_DB.dbGetAll('recipes');
  const shoppingItems = await HD_DB.dbGetAll('shoppingItems');
  const existingNames = new Set(shoppingItems.filter((s) => !s.checked).map((s) => s.item.trim().toLowerCase()));

  const inRange = plans.filter((p) => {
    const d = HD_CAL.parseYMD(p.date);
    return d >= rangeStart && d <= rangeEnd;
  });

  let added = 0;
  for (const plan of inRange) {
    const recipe = recipes.find((r) => r.id === plan.recipeId);
    if (!recipe) continue;
    const lines = (recipe.ingredients || '').split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const key = line.toLowerCase();
      if (existingNames.has(key)) continue;
      await HD_DB.dbPut('shoppingItems', {
        id: crypto.randomUUID(),
        item: line,
        qty: '',
        category: 'Meal plan',
        addedBy: 'Both',
        checked: false,
        createdAt: Date.now(),
      });
      existingNames.add(key);
      added++;
    }
  }
  return added;
}

window.HD_RECIPES = { renderRecipesTab, cleanupPhotoUrls };
