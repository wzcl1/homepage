const linkForm = document.getElementById('link-form');
const noteForm = document.getElementById('note-form');
const linkList = document.getElementById('link-list');
const noteList = document.getElementById('note-list');
const statusEl = document.getElementById('status');

let statusTimer;

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (type ? ' ' + type : '');
  clearTimeout(statusTimer);
  if (message) {
    statusTimer = setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status';
    }, 4000);
  }
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

function renderEmpty(container, text) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  container.appendChild(li);
}

function makeLinkItem(link) {
  const li = document.createElement('li');
  li.className = 'link-item row with-actions';

  const content = document.createElement('div');
  content.className = 'row-content';

  const main = document.createElement('div');
  main.className = 'item-main';

  const a = document.createElement('a');
  a.href = link.url;
  a.textContent = link.label || link.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  const label = document.createElement('span');
  label.className = 'link-label' + (link.label ? '' : ' hidden');
  label.textContent = link.url;

  main.appendChild(a);
  main.appendChild(label);
  content.appendChild(main);

  const actions = document.createElement('div');
  actions.className = 'row-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'edit';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => renderLinkEditor(li, link));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'delete';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteLink(link.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(content);
  li.appendChild(actions);
  return li;
}

function renderLinkEditor(li, link) {
  closeAllRows();
  const editor = document.createElement('div');
  editor.className = 'editing';

  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.value = link.url;

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.value = link.label || '';

  const actions = document.createElement('div');
  actions.className = 'editing-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'delete';
  cancelBtn.textContent = 'Cancel';

  saveBtn.addEventListener('click', async () => {
    try {
      const links = await api(`/api/links/${link.id}`, {
        method: 'PUT',
        body: JSON.stringify({ url: urlInput.value, label: labelInput.value }),
      });
      state.links = links;
      renderAll();
      setStatus('Link updated.', 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  });

  cancelBtn.addEventListener('click', renderAll);

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  editor.appendChild(urlInput);
  editor.appendChild(labelInput);
  editor.appendChild(actions);

  li.replaceChildren(editor);
  urlInput.focus();
}

function makeNoteItem(note) {
  const li = document.createElement('li');
  li.className = 'note-item row with-actions';

  const content = document.createElement('div');
  content.className = 'row-content';

  const text = document.createElement('div');
  text.className = 'note-text clamped';
  text.textContent = note.text;

  const wrapper = document.createElement('div');
  wrapper.className = 'notes-content-wrapper';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'note-toggle';
  toggle.textContent = 'Show more';
  toggle.addEventListener('click', () => {
    const expanded = !text.classList.toggle('clamped');
    toggle.textContent = expanded ? 'Show less' : 'Show more';
  });

  wrapper.appendChild(text);
  content.appendChild(wrapper);

  const actions = document.createElement('div');
  actions.className = 'row-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'edit';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => renderNoteEditor(li, note));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'delete';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteNote(note.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  const metaRow = document.createElement('div');
  metaRow.className = 'note-meta-row';
  metaRow.appendChild(toggle);
  content.appendChild(metaRow);

  li.appendChild(content);
  li.appendChild(actions);
  return li;
}

function renderNoteEditor(li, note) {
  closeAllRows();
  const editor = document.createElement('div');
  editor.className = 'editing';

  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.value = note.text;

  const actions = document.createElement('div');
  actions.className = 'editing-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'delete';
  cancelBtn.textContent = 'Cancel';

  saveBtn.addEventListener('click', async () => {
    try {
      const notes = await api(`/api/notes/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({ text: textarea.value }),
      });
      state.notes = notes;
      renderAll();
      setStatus('Note updated.', 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  });

  cancelBtn.addEventListener('click', renderAll);

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  editor.appendChild(textarea);
  editor.appendChild(actions);

  li.replaceChildren(editor);
  textarea.focus();
}

const state = { links: [], notes: [] };

function renderAll() {
  linkList.replaceChildren();
  noteList.replaceChildren();

  document.getElementById('link-count').textContent = state.links.length;
  document.getElementById('note-count').textContent = state.notes.length;

  const links = [...state.links].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const notes = [...state.notes].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  if (links.length === 0) {
    renderEmpty(linkList, 'No links yet.');
  } else {
    links.forEach((link) => linkList.appendChild(makeLinkItem(link)));
  }

  if (notes.length === 0) {
    renderEmpty(noteList, 'No notes yet.');
  } else {
    notes.forEach((note) => noteList.appendChild(makeNoteItem(note)));
  }

  noteList.querySelectorAll('.note-text').forEach((el) => {
    const toggle = el.closest('.note-item').querySelector('.note-toggle');
    el.classList.remove('clamped');
    const expandedHeight = el.offsetHeight;
    el.classList.add('clamped');
    const clampedHeight = el.clientHeight;
    if (toggle && expandedHeight > clampedHeight) {
      toggle.classList.add('visible');
    }
    if (el.scrollWidth > el.clientWidth) {
      el.parentElement.classList.add('scrollable');
    }
  });

  document.querySelectorAll('.row.with-actions').forEach((row) => {
    const width = row.querySelector('.row-actions').offsetWidth;
    if (width) row.style.setProperty('--aw', width + 'px');
  });
}

window.addEventListener('resize', () => {
  document.querySelectorAll('.row.with-actions').forEach((row) => {
    if (row.classList.contains('swiped')) return;
    const width = row.querySelector('.row-actions').offsetWidth;
    if (width) row.style.setProperty('--aw', width + 'px');
  });
});

async function addLink(event) {
  event.preventDefault();
  const urlInput = document.getElementById('link-url');
  const labelInput = document.getElementById('link-label');
  const url = urlInput.value.trim();
  if (!/^https?:\/\/.+/.test(url)) {
    setStatus('URL must start with http:// or https://.', 'error');
    return;
  }
  try {
    const links = await api('/api/links', {
      method: 'POST',
      body: JSON.stringify({ url, label: labelInput.value }),
    });
    state.links = links;
    renderAll();
    linkForm.reset();
    setStatus('Link added.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function addNote(event) {
  event.preventDefault();
  const textarea = document.getElementById('note-text');
  const text = textarea.value.trim();
  if (!text) return;
  try {
    const notes = await api('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    state.notes = notes;
    renderAll();
    noteForm.reset();
    setStatus('Note added.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function deleteLink(id) {
  if (!confirm('Delete this link?')) return;
  try {
    const links = await api(`/api/links/${id}`, { method: 'DELETE' });
    state.links = links;
    renderAll();
    setStatus('Link deleted.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  try {
    const notes = await api(`/api/notes/${id}`, { method: 'DELETE' });
    state.notes = notes;
    renderAll();
    setStatus('Note deleted.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

linkForm.addEventListener('submit', addLink);
noteForm.addEventListener('submit', addNote);

function closeAllRows() {
  document.querySelectorAll('.row.swiped').forEach((el) => {
    el.classList.remove('swiped', 'dragging');
    const a = el.querySelector('.row-actions');
    if (a) a.style.transform = '';
  });
}

(function initSwipeReveal() {
  let active = null;
  let startX = 0;
  let startY = 0;
  let startOpen = false;
  let px = 0;
  let dragging = false;
  let suppressClick = false;

  function switchRow(open) {
    const a = active.querySelector('.row-actions');
    if (a) a.style.transform = '';
    active.classList.remove('dragging');
    active.classList.toggle('swiped', open);
  }

  document.addEventListener('pointerdown', (event) => {
    const row = event.target.closest('.row');
    if (!row || event.target.closest('button, a, input, textarea, .row-actions')) return;
    active = row;
    startX = event.clientX;
    startY = event.clientY;
    startOpen = row.classList.contains('swiped');
    px = startOpen ? parseFloat(row.style.getPropertyValue('--aw')) || 150 : 0;
    dragging = false;
    suppressClick = false;
  });

  document.addEventListener('pointermove', (event) => {
    if (!active) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      dragging = true;
    }
    if (dragging) {
      const aw = parseFloat(active.style.getPropertyValue('--aw')) || 150;
      px = Math.max(0, Math.min(aw, startOpen ? aw - dx : -dx));
      active.classList.add('dragging');
      const pct = 100 - (px / aw) * 100;
      active.querySelector('.row-actions').style.transform = `translateX(${pct.toFixed(2)}%)`;
    }
  });

  function stopGesture(event) {
    if (!active) return;
    if (dragging) {
      const aw = parseFloat(active.style.getPropertyValue('--aw')) || 150;
      switchRow(px >= aw / 2);
      suppressClick = true;
    }
    active = null;
    dragging = false;
  }

  document.addEventListener('pointerup', stopGesture);
  document.addEventListener('pointercancel', stopGesture);

  document.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target.closest('.row-actions')) return;
    const row = event.target.closest('.row');
    if (row && row.classList.contains('swiped')) {
      event.preventDefault();
      closeAllRows();
      return;
    }
    if (!row) closeAllRows();
  });
})();

const fab = document.getElementById('fab');
const sheetMask = document.getElementById('sheet-mask');

function openAddForm(panelId) {
  const panel = document.getElementById(panelId);
  const section = panel.querySelector('.section-toggle');
  if (section) section.open = true;

  const isLink = panelId === 'links-panel';
  const show = document.getElementById(isLink ? 'link-form' : 'note-form');
  const hide = document.getElementById(isLink ? 'note-form' : 'link-form');
  hide.setAttribute('hidden', '');
  show.removeAttribute('hidden');

  const field = show.querySelector('input, textarea');
  if (field) {
    field.focus();
    show.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

fab.addEventListener('click', () => {
  sheetMask.classList.remove('hidden');
});

sheetMask.querySelectorAll('.bottom-sheet button').forEach((btn) => {
  btn.addEventListener('click', () => {
    sheetMask.classList.add('hidden');
    const panelId = btn.dataset.action === 'link' ? 'links-panel' : 'notes-panel';
    openAddForm(panelId);
  });
});

sheetMask.addEventListener('click', (event) => {
  if (event.target === sheetMask) sheetMask.classList.add('hidden');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') sheetMask.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

(async () => {
  try {
    const data = await api('/api/data');
    state.links = data.links || [];
    state.notes = data.notes || [];
  } catch (err) {
    setStatus(err.message, 'error');
  }
  renderAll();
})();