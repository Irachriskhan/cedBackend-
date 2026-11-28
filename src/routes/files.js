/*
 * Serves images at /uploads/<name>. It looks in three places, in this order:
 *   1. the uploads folder on disk (older uploads, local development)
 *   2. the project's seed-images folder (the CED photos, names starting with "ced-")
 *   3. the database (everything uploaded in the admin area)
 * Image names never change, so browsers may keep them for a long time.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { UploadFile } = require('../models');
const { uploadDir, seedImagesDir, mimeFromName } = require('../middleware/upload');

const router = express.Router();
const LONG = 'public, max-age=31536000, immutable';

// A small memory cache so popular images are not read from the database every time.
const memory = new Map();
const MEMORY_LIMIT = 40 * 1024 * 1024;
let memoryBytes = 0;
function remember(name, entry) {
  if (entry.data.length > 5 * 1024 * 1024) return;
  while (memoryBytes + entry.data.length > MEMORY_LIMIT && memory.size) {
    const [oldest, value] = memory.entries().next().value;
    memory.delete(oldest);
    memoryBytes -= value.data.length;
  }
  memory.set(name, entry);
  memoryBytes += entry.data.length;
}

const safe = (name) => /^[\w.-]+$/.test(name) && !name.startsWith('.');
const send = (res, mime, data) => res.set({ 'Content-Type': mime, 'Cache-Control': LONG, 'Content-Length': data.length }).send(data);

router.get('/:name', async (req, res, next) => {
  const { name } = req.params;
  if (!safe(name)) return res.status(404).end();
  try {
    const onDisk = path.join(uploadDir, name);
    if (fs.existsSync(onDisk)) return res.set('Cache-Control', LONG).sendFile(onDisk);

    if (name.startsWith('ced-')) {
      const seeded = path.join(seedImagesDir, name.slice(4));
      if (fs.existsSync(seeded)) return res.set('Cache-Control', LONG).sendFile(seeded);
    }

    const cached = memory.get(name);
    if (cached) return send(res, cached.mime, cached.data);

    const row = await UploadFile.findOne({ where: { name } });
    if (!row) return res.status(404).set('Cache-Control', 'no-cache').end();
    const entry = { mime: row.mime || mimeFromName(name) || 'application/octet-stream', data: Buffer.from(row.data) };
    remember(name, entry);
    return send(res, entry.mime, entry.data);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
