const linkForm = document.getElementById('link-form');
const noteForm = document.getElementById('note-form');
const linkList = document.getElementById('link-list');
const noteList = document.getElementById('note-list');
const statusEl = document.getElementById('status');

const state = { links: [], notes: [] };

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

function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

function copyNote(copyBtn, text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.resolve(copyTextFallback(text));
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

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'copy-note';
  copyBtn.setAttribute('aria-label', 'Copy note');
  copyBtn.innerHTML =
    '<svg class="icon-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
    '<svg class="icon-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  copyBtn.addEventListener('click', () => {
    copyNote(copyBtn, note.text).then(() => {
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 1500);
    }).catch(() => {
      setStatus('Copy failed.', 'error');
    });
  });
  content.appendChild(copyBtn);

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

function renderAll() {
  linkList.replaceChildren();
  noteList.replaceChildren();

  document.getElementById('link-count').textContent = state.links.length;
  document.getElementById('note-count').textContent = state.notes.length;

  const byCreatedDesc = (a, b) => (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
  const links = [...state.links].sort(byCreatedDesc);
  const notes = [...state.notes].sort(byCreatedDesc);

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
    linkForm.setAttribute('hidden', '');
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
    noteForm.setAttribute('hidden', '');
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

document.querySelectorAll('.add-form .form-actions button.cancel').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.closest('.add-form').setAttribute('hidden', '');
  });
});

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

(function initSheetSwipeDown() {
  const sheet = sheetMask.querySelector('.bottom-sheet');
  let startY = 0;
  let active = false;

  sheetMask.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.bottom-sheet')) return;
    startY = event.clientY;
    active = true;
  });

  function close() {
    if (!active) return;
    active = false;
    if (!sheet.classList.contains('dragging')) return;
    const dy = parseFloat(sheet.style.transform.replace(/[^0-9.-]/g, '')) || 0;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    sheetMask.style.opacity = '';
    if (dy > 120) sheetMask.classList.add('hidden');
  }

  sheetMask.addEventListener('pointermove', (event) => {
    if (!active || sheetMask.classList.contains('hidden')) return;
    const dy = event.clientY - startY;
    if (dy <= 0) return;
    sheet.classList.add('dragging');
    sheet.style.transform = `translateY(${dy}px)`;
    sheetMask.style.opacity = String(Math.max(0, 1 - dy / 400));
  });

  sheetMask.addEventListener('pointerup', close);
  sheetMask.addEventListener('pointercancel', close);
})();

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