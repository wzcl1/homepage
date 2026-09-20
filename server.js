const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data', 'data.json');

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

function httpUrl(value) {
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
}

function validateLink(body) {
  const url = httpUrl(body && body.url);
  if (!url) return { error: 'A valid http(s) URL is required.' };
  const label = body && typeof body.label === 'string' ? body.label.trim() : '';
  return { item: { url, label } };
}

function validateNote(body) {
  const text = body && typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return { error: 'Note text is required.' };
  return { item: { text } };
}

function makeCollectionRouter(key, noun, validate) {
  const notFound = Object.assign(new Error(`${noun} not found.`), { status: 404 });

  app.post(`/api/${key}`, (req, res, next) => {
    const { item, error } = validate(req.body);
    if (error) return res.status(400).json({ error });
    withMutation(() => {
      const data = readData();
      data[key].push({ id: crypto.randomUUID(), ...item, createdAt: new Date().toISOString() });
      atomicWrite(data);
      return data[key];
    }).then((items) => res.json(items), next);
  });

  app.put(`/api/${key}/:id`, (req, res, next) => {
    const { item, error } = validate(req.body);
    if (error) return res.status(400).json({ error });
    withMutation(() => {
      const data = readData();
      const existing = data[key].find((x) => x.id === req.params.id);
      if (!existing) throw notFound;
      Object.assign(existing, item);
      atomicWrite(data);
      return data[key];
    }).then((items) => res.json(items), next);
  });

  app.delete(`/api/${key}/:id`, (req, res, next) => {
    withMutation(() => {
      const data = readData();
      const before = data[key].length;
      data[key] = data[key].filter((x) => x.id !== req.params.id);
      if (data[key].length === before) throw notFound;
      atomicWrite(data);
      return data[key];
    }).then((items) => res.json(items), next);
  });
}

app.get('/api/data', (req, res, next) => {
  try {
    res.json(readData());
  } catch (err) {
    next(err);
  }
});

makeCollectionRouter('links', 'Link', validateLink);
makeCollectionRouter('notes', 'Note', validateNote);

app.use((err, req, res, next) => {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error(err);
  res.status(500).json({ error: 'Server error.' });
});

ensureDataFile();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`homepage listening on http://0.0.0.0:${PORT}, data at ${DATA_PATH}`);
});
