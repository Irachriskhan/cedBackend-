const express = require('express');
const { requireAuth } = require('../middleware/auth');

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 170);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Keep only the fields an editor is allowed to set. Empty strings become null. */
function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] === undefined) continue;
    out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

async function uniqueSlug(Model, base, ignoreId) {
  let slug = slugify(base) || 'item';
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (true) {
    const found = await Model.findOne({ where: { slug } });
    if (!found || String(found.id) === String(ignoreId)) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

/**
 * Builds the usual routes for one content type.
 *   GET  /            public  – published items only
 *   GET  /all         admin   – everything
 *   GET  /:idOrSlug   public  – one published item
 *   POST / PUT /:id / DELETE /:id   admin
 */
function crud(Model, { fields, order = [['sortOrder', 'ASC'], ['id', 'ASC']], hasSlug = false, slugFrom = 'title', isPublic = true, beforeSave }) {
  const router = express.Router();
  const hasPublished = Boolean(Model.rawAttributes.published);
  const visible = hasPublished ? { published: true } : {};

  if (isPublic) {
    router.get('/', wrap(async (req, res) => {
      const limit = Math.min(Number(req.query.limit) || 100, 100);
      res.json(await Model.findAll({ where: visible, order, limit }));
    }));
  }

  router.get('/all', requireAuth, wrap(async (req, res) => res.json(await Model.findAll({ order }))));

  if (isPublic) {
    router.get('/:idOrSlug', wrap(async (req, res) => {
      const key = req.params.idOrSlug;
      const where = hasSlug && !/^\d+$/.test(key) ? { slug: key, ...visible } : { id: key, ...visible };
      const item = await Model.findOne({ where });
      if (!item) return res.status(404).json({ message: 'Not found.' });
      res.json(item);
    }));
  }

  router.post('/', requireAuth, wrap(async (req, res) => {
    const data = pick(req.body, fields);
    if (hasSlug) data.slug = await uniqueSlug(Model, data.slug || data[slugFrom]);
    if (beforeSave) beforeSave(data, null);
    res.status(201).json(await Model.create(data));
  }));

  router.put('/:id', requireAuth, wrap(async (req, res) => {
    const item = await Model.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found.' });
    const data = pick(req.body, fields);
    if (hasSlug && (data.slug || !item.slug)) data.slug = await uniqueSlug(Model, data.slug || data[slugFrom] || item[slugFrom], item.id);
    if (beforeSave) beforeSave(data, item);
    await item.update(data);
    res.json(item);
  }));

  router.delete('/:id', requireAuth, wrap(async (req, res) => {
    const item = await Model.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found.' });
    await item.destroy();
    res.json({ message: 'Deleted.' });
  }));

  return router;
}

module.exports = { crud, wrap, pick, slugify };
