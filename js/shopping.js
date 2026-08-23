async function renderShoppingTab(main) {
  main.innerHTML = `
    <div class="tab-header"><h2>Shopping list</h2></div>
    <form id="shopping-form" class="inline-form shopping-form">
      <input name="item" placeholder="Item" required>
      <input name="qty" placeholder="Qty (optional)">
      <input name="category" placeholder="Category (optional)">
      <select name="addedBy">${HD_SETTINGS.getAssigneeOptions().map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
      <button type="submit">Add</button>
    </form>
    <div class="shopping-toolbar">
      <button type="button" id="clear-checked-btn">Clear checked</button>
    </div>
    <div id="shopping-list"></div>`;

  const listEl = document.getElementById('shopping-list');
  let editingId = null;

  function editFormHtml(it) {
    return `
      <form class="item-edit-form" data-edit-form="${it.id}">
        <input name="item" value="${HD_CAL.escapeHtml(it.item)}" required>
        <input name="qty" value="${HD_CAL.escapeHtml(it.qty || '')}" placeholder="Qty (optional)">
        <input name="category" value="${HD_CAL.escapeHtml(it.category || '')}" placeholder="Category (optional)">
        <div class="modal-form-actions">
          <button type="button" data-cancel-edit>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>`;
  }

  async function refresh() {
    const items = await HD_DB.dbGetAll('shoppingItems');
    items.sort((a, b) => (a.checked - b.checked) || (a.category || '').localeCompare(b.category || '') || (a.createdAt - b.createdAt));

    if (items.length === 0) {
      listEl.innerHTML = '<p class="text-muted">Shopping list is empty.</p>';
      return;
    }

    const groups = new Map();
    for (const it of items) {
      const cat = it.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(it);
    }

    listEl.innerHTML = [...groups.entries()].map(([cat, catItems]) => `
      <div class="shopping-group">
        <h5>${HD_CAL.escapeHtml(cat)}</h5>
        ${catItems.map((it) => it.id === editingId ? editFormHtml(it) : `
          <div class="shopping-row ${it.checked ? 'checked' : ''}" data-id="${it.id}">
            <label class="shopping-row-main">
              <input type="checkbox" data-check="${it.id}" ${it.checked ? 'checked' : ''}>
              <span>${HD_CAL.escapeHtml(it.item)}${it.qty ? ` <span class="badge">${HD_CAL.escapeHtml(it.qty)}</span>` : ''}</span>
            </label>
            <div class="task-actions">
              <button type="button" data-edit="${it.id}">Edit</button>
              <button type="button" data-delete="${it.id}">Delete</button>
            </div>
          </div>`).join('')}
      </div>`).join('');

    listEl.querySelectorAll('[data-check]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const item = items.find((i) => i.id === cb.dataset.check);
        item.checked = cb.checked;
        await HD_DB.dbPut('shoppingItems', item);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await HD_DB.dbDelete('shoppingItems', btn.dataset.delete);
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
        const item = items.find((i) => i.id === id);
        const fd = new FormData(form);
        const name = fd.get('item').trim();
        if (!name) return;
        item.item = name;
        item.qty = fd.get('qty').trim();
        item.category = fd.get('category').trim();
        await HD_DB.dbPut('shoppingItems', item);
        editingId = null;
        refresh();
      });
    });
  }

  document.getElementById('shopping-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const item = fd.get('item').trim();
    if (!item) return;
    await HD_DB.dbPut('shoppingItems', {
      id: crypto.randomUUID(),
      item,
      qty: fd.get('qty').trim(),
      category: fd.get('category').trim(),
      addedBy: fd.get('addedBy'),
      checked: false,
      createdAt: Date.now(),
    });
    ev.target.reset();
    refresh();
  });

  document.getElementById('clear-checked-btn').addEventListener('click', async () => {
    const items = await HD_DB.dbGetAll('shoppingItems');
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) return;
    if (!confirm(`Remove ${checked.length} checked item(s)?`)) return;
    for (const i of checked) await HD_DB.dbDelete('shoppingItems', i.id);
    refresh();
  });

  refresh();
}

window.HD_SHOPPING = { renderShoppingTab };
