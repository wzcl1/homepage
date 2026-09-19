const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFile() {
  if (fs.existsSync(DATA_PATH)) return;
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify({ links: [], notes: [] }, null, 2));
}

function readData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.links) || !Array.isArray(data.notes)) {
    throw new Error('data.json has an unexpected shape');
  }
  return data;
}

function atomicWrite(data) {
  const tmp = `${DATA_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_PATH);
}

let mutationQueue = Promise.resolve();

function withMutation(fn) {
  const run = mutationQueue.then(fn);
  mutationQueue = run.catch(() => {});
  return run;
}

const httpUrl = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.toString();
};

app.get('/api/data', (req, res, next) => {
  try {
    ensureDataFile();
    res.json(readData());
  } catch (err) {
    next(err);
  }
});

app.post('/api/links', (req, res, next) => {
  const url = httpUrl(req.body && req.body.url);
  const label = req.body && typeof req.body.label === 'string' ? req.body.label.trim() : '';
  if (!url) return res.status(400).json({ error: 'A valid http(s) URL is required.' });
  withMutation(() => {
    const data = readData();
    data.links.push({ id: crypto.randomUUID(), label, url, createdAt: new Date().toISOString() });
    atomicWrite(data);
    return data.links;
  }).then((links) => res.json(links), next);
});

app.put('/api/links/:id', (req, res, next) => {
  const { id } = req.params;
  const url = httpUrl(req.body && req.body.url);
  const label = req.body && typeof req.body.label === 'string' ? req.body.label.trim() : '';
  if (!url) return res.status(400).json({ error: 'A valid http(s) URL is required.' });
  withMutation(() => {
    const data = readData();
    const item = data.links.find((l) => l.id === id);
    if (!item) throw Object.assign(new Error('Link not found.'), { status: 404 });
    item.url = url;
    item.label = label;
    atomicWrite(data);
    return data.links;
  }).then((links) => res.json(links), next);
});

app.delete('/api/links/:id', (req, res, next) => {
  const { id } = req.params;
  withMutation(() => {
    const data = readData();
    const before = data.links.length;
    data.links = data.links.filter((l) => l.id !== id);
    if (data.links.length === before) throw Object.assign(new Error('Link not found.'), { status: 404 });
    atomicWrite(data);
    return data.links;
  }).then((links) => res.json(links), next);
});

app.post('/api/notes', (req, res, next) => {
  const text = req.body && typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Note text is required.' });
  withMutation(() => {
    const data = readData();
    data.notes.push({ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() });
    atomicWrite(data);
    return data.notes;
  }).then((notes) => res.json(notes), next);
});

app.put('/api/notes/:id', (req, res, next) => {
  const { id } = req.params;
  const text = req.body && typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Note text is required.' });
  withMutation(() => {
    const data = readData();
    const item = data.notes.find((n) => n.id === id);
    if (!item) throw Object.assign(new Error('Note not found.'), { status: 404 });
    item.text = text;
    atomicWrite(data);
    return data.notes;
  }).then((notes) => res.json(notes), next);
});

app.delete('/api/notes/:id', (req, res, next) => {
  const { id } = req.params;
  withMutation(() => {
    const data = readData();
    const before = data.notes.length;
    data.notes = data.notes.filter((n) => n.id !== id);
    if (data.notes.length === before) throw Object.assign(new Error('Note not found.'), { status: 404 });
    atomicWrite(data);
    return data.notes;
  }).then((notes) => res.json(notes), next);
});

app.use((err, req, res, next) => {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Server error.' });
});

ensureDataFile();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`homepage listening on http://0.0.0.0:${PORT}, data at ${DATA_PATH}`);
});