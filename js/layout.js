const LAYOUT_KEY = 'hd-layout';
const DEFAULT_SIDEBAR_ORDER = ['decide', 'trip', 'weather', 'digest', 'goal', 'agenda', 'notesShopping'];

let editMode = false;

function getLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLayout(patch) {
  const merged = { ...getLayout(), ...patch };
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(merged));
  return merged;
}

function getSidebarOrder() {
  const saved = getLayout().sidebarOrder || [];
  const missing = DEFAULT_SIDEBAR_ORDER.filter((id) => !saved.includes(id));
  const known = saved.filter((id) => DEFAULT_SIDEBAR_ORDER.includes(id));
  return [...known, ...missing];
}

function saveSidebarOrder(order) {
  saveLayout({ sidebarOrder: order });
}

function getSize(id) {
  return (getLayout().sizes || {})[id] || null;
}

function saveSize(id, size) {
  const sizes = { ...(getLayout().sizes || {}), [id]: size };
  saveLayout({ sizes });
}

function resetLayout() {
  localStorage.removeItem(LAYOUT_KEY);
}

function isEditMode() {
  return editMode;
}

// Watches an element for user-driven resizes (native CSS `resize` handle) and
// persists the final size, debounced so we don't write on every pixel.
function trackResize(el, id) {
  const saved = getSize(id);
  if (saved) {
    el.style.width = saved.width;
    el.style.height = saved.height;
  }
  let debounceId = null;
  const observer = new ResizeObserver(() => {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      saveSize(id, { width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px` });
    }, 400);
  });
  observer.observe(el);
}

// Lightweight pointer-based drag-to-reorder for the sidebar cards. Native
// HTML5 drag-and-drop doesn't work on touchscreens, so this uses Pointer
// Events (unifies mouse + touch) instead.
function enableSidebarDrag(container, onReorder) {
  let dragEl = null;

  container.querySelectorAll('.drag-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (ev) => {
      if (!editMode) return;
      dragEl = handle.closest('.card');
      dragEl.classList.add('dragging');
      handle.setPointerCapture(ev.pointerId);
    });

    handle.addEventListener('pointermove', (ev) => {
      if (!dragEl) return;
      const cards = [...container.querySelectorAll('.card')];
      const target = cards.find((c) => {
        if (c === dragEl) return false;
        const r = c.getBoundingClientRect();
        return ev.clientY >= r.top && ev.clientY <= r.bottom;
      });
      if (target) {
        const dragRect = dragEl.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        if (dragRect.top < targetRect.top) target.after(dragEl);
        else target.before(dragEl);
      }
    });

    handle.addEventListener('pointerup', () => {
      if (!dragEl) return;
      dragEl.classList.remove('dragging');
      const order = [...container.querySelectorAll('.card[data-card-id]')].map((c) => c.dataset.cardId);
      dragEl = null;
      onReorder(order);
    });
  });
}

function toggleEditMode(dashboardEl) {
  editMode = !editMode;
  dashboardEl.classList.toggle('layout-edit-mode', editMode);
  return editMode;
}

window.HD_LAYOUT = {
  getSidebarOrder, saveSidebarOrder, getSize, saveSize, resetLayout,
  isEditMode, trackResize, enableSidebarDrag, toggleEditMode, DEFAULT_SIDEBAR_ORDER,
};
