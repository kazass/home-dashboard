function compressImage(file, maxDim = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function plantNextWaterDue(plant) {
  if (plant.lastWateredAt) {
    return HD_SCHEDULING.addUnits(new Date(plant.lastWateredAt), plant.waterIntervalCount, plant.waterIntervalUnit);
  }
  return HD_CAL.parseYMD(plant.createdDateStr);
}

async function getPlantWaterItemsInRange(rangeStart, rangeEnd) {
  const plants = await HD_DB.dbGetAll('plants');
  const items = [];
  for (const p of plants) {
    const due = plantNextWaterDue(p);
    if (due >= rangeStart && due <= rangeEnd) {
      items.push({
        id: `plant-${p.id}-${HD_CAL.ymd(due)}`,
        title: `Water: ${p.name}`,
        date: HD_CAL.ymd(due),
        type: 'plant',
        assignedTo: 'Both',
        isSchedule: true,
        category: 'plant',
      });
    }
  }
  return items;
}

function photoSrc(plant) {
  if (plant.photoBlob) return URL.createObjectURL(plant.photoBlob);
  if (plant.photoUrl) return plant.photoUrl;
  return null;
}

async function renderGardenTab(main) {
  main.innerHTML = `
    <div class="tab-header"><h2>Garden</h2><p class="text-muted">Plants and flowers — watering schedule and care notes (type these in yourself from whatever source you found, no auto-fetching).</p></div>
    <form id="plant-form" class="inline-form">
      <input name="name" placeholder="Plant name" required>
      <input type="file" name="photoFile" accept="image/*">
      <input name="photoUrl" placeholder="...or paste an image URL">
      <input name="sunlight" placeholder="Sunlight (optional, e.g. full sun)">
      <label>Water every
        <input type="number" name="waterIntervalCount" min="1" value="7" style="width:60px">
        <select name="waterIntervalUnit">
          <option value="days" selected>Days</option>
          <option value="weeks">Weeks</option>
        </select>
      </label>
      <textarea name="careInstructions" placeholder="Care instructions — grow, water, trim, etc."></textarea>
      <input name="sourceUrl" placeholder="Source link (optional)">
      <button type="submit">Add plant</button>
    </form>
    <div id="plant-list" class="plant-grid"></div>`;

  const listEl = document.getElementById('plant-list');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function dueBadge(due) {
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return `<span class="task-due overdue">Overdue by ${-diffDays}d</span>`;
    if (diffDays === 0) return '<span class="task-due due-today">Water today</span>';
    return `<span class="task-due">Water in ${diffDays}d</span>`;
  }

  let editingId = null;

  function editFormHtml(p) {
    return `
      <form class="item-edit-form plant-body" data-edit-form="${p.id}">
        <input name="name" value="${HD_CAL.escapeHtml(p.name)}" required>
        <input type="file" name="photoFile" accept="image/*">
        <input name="photoUrl" value="${HD_CAL.escapeHtml(p.photoUrl || '')}" placeholder="...or paste an image URL">
        <input name="sunlight" value="${HD_CAL.escapeHtml(p.sunlight || '')}" placeholder="Sunlight (optional)">
        <div class="recurrence-fields">
          <input type="number" name="waterIntervalCount" min="1" value="${p.waterIntervalCount}" style="width:60px">
          <select name="waterIntervalUnit">
            <option value="days" ${p.waterIntervalUnit === 'days' ? 'selected' : ''}>Days</option>
            <option value="weeks" ${p.waterIntervalUnit === 'weeks' ? 'selected' : ''}>Weeks</option>
          </select>
        </div>
        <textarea name="careInstructions" placeholder="Care instructions">${HD_CAL.escapeHtml(p.careInstructions || '')}</textarea>
        <input name="sourceUrl" value="${HD_CAL.escapeHtml(p.sourceUrl || '')}" placeholder="Source link (optional)">
        <div class="modal-form-actions">
          <button type="button" data-cancel-edit>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>`;
  }

  async function refresh() {
    const plants = await HD_DB.dbGetAll('plants');
    plants.sort((a, b) => plantNextWaterDue(a) - plantNextWaterDue(b));

    listEl.innerHTML = plants.length
      ? plants.map((p) => {
        if (p.id === editingId) return `<div class="plant-card" data-id="${p.id}">${editFormHtml(p)}</div>`;
        const due = plantNextWaterDue(p);
        const src = photoSrc(p);
        return `
          <div class="plant-card" data-id="${p.id}">
            ${src ? `<img class="plant-photo" src="${src}" alt="${HD_CAL.escapeHtml(p.name)}">` : '<div class="plant-photo plant-photo-empty">No photo</div>'}
            <div class="plant-body">
              <div class="task-row-main">
                <span class="task-title">${HD_CAL.escapeHtml(p.name)}</span>
                ${p.sunlight ? `<span class="badge">${HD_CAL.escapeHtml(p.sunlight)}</span>` : ''}
              </div>
              <div>${dueBadge(due)} <span class="text-muted">every ${p.waterIntervalCount} ${p.waterIntervalUnit}</span></div>
              ${p.careInstructions ? `<div class="task-notes text-muted">${HD_CAL.escapeHtml(p.careInstructions)}</div>` : ''}
              ${p.sourceUrl ? `<div><a href="${HD_CAL.escapeHtml(p.sourceUrl)}" target="_blank" rel="noopener">Source</a></div>` : ''}
              <div class="task-actions">
                <button type="button" data-watered="${p.id}">Mark watered</button>
                <button type="button" data-edit="${p.id}">Edit</button>
                <button type="button" data-delete="${p.id}">Delete</button>
              </div>
            </div>
          </div>`;
      }).join('')
      : '<p class="text-muted">No plants yet.</p>';

    listEl.querySelectorAll('[data-watered]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const plant = plants.find((p) => p.id === btn.dataset.watered);
        const wateredAt = new Date();
        wateredAt.setHours(0, 0, 0, 0);
        plant.lastWateredAt = wateredAt.getTime();
        await HD_DB.dbPut('plants', plant);
        refresh();
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this plant?')) return;
        await HD_DB.dbDelete('plants', btn.dataset.delete);
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
        const plant = plants.find((p) => p.id === id);
        const fd = new FormData(form);
        const name = fd.get('name').trim();
        if (!name) return;

        const file = fd.get('photoFile');
        if (file && file.size > 0) {
          plant.photoBlob = await compressImage(file);
          plant.photoUrl = '';
        } else {
          const newUrl = fd.get('photoUrl').trim();
          if (newUrl !== (plant.photoUrl || '')) {
            plant.photoUrl = newUrl;
            plant.photoBlob = null;
          }
        }

        plant.name = name;
        plant.sunlight = fd.get('sunlight').trim();
        plant.waterIntervalCount = Number(fd.get('waterIntervalCount')) || 7;
        plant.waterIntervalUnit = fd.get('waterIntervalUnit');
        plant.careInstructions = fd.get('careInstructions').trim();
        plant.sourceUrl = fd.get('sourceUrl').trim();
        await HD_DB.dbPut('plants', plant);
        editingId = null;
        refresh();
      });
    });
  }

  document.getElementById('plant-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const name = fd.get('name').trim();
    if (!name) return;

    const file = fd.get('photoFile');
    let photoBlob = null;
    if (file && file.size > 0) {
      photoBlob = await compressImage(file);
    }

    const createdToday = new Date();
    createdToday.setHours(0, 0, 0, 0);

    await HD_DB.dbPut('plants', {
      id: crypto.randomUUID(),
      name,
      photoBlob,
      photoUrl: photoBlob ? '' : fd.get('photoUrl').trim(),
      sunlight: fd.get('sunlight').trim(),
      waterIntervalCount: Number(fd.get('waterIntervalCount')) || 7,
      waterIntervalUnit: fd.get('waterIntervalUnit'),
      careInstructions: fd.get('careInstructions').trim(),
      sourceUrl: fd.get('sourceUrl').trim(),
      lastWateredAt: null,
      createdDateStr: HD_CAL.ymd(createdToday),
      createdAt: Date.now(),
    });
    ev.target.reset();
    refresh();
  });

  refresh();
}

window.HD_GARDEN = { renderGardenTab, getPlantWaterItemsInRange, plantNextWaterDue, compressImage };
