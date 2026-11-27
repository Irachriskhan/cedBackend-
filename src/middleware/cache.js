/**
 * Short-lived memory cache for public data (programmes, news, settings...).
 *
 * Every page of the website asks the API for the same lists. Without a cache each
 * visit opens database connections; on shared hosting, which allows only a few
 * connections, busy moments then fail. With it, the database is asked at most once
 * a minute per list, and every change made in the admin area clears the cache at once.
 */
const TTL = (Number(process.env.CACHE_SECONDS) || 60) * 1000;
const store = new Map();
const MAX_ENTRIES = 300;

function clear() {
  store.clear();
}

function cachePublicGets(req, res, next) {
  // Only anonymous GET requests are cached; anything signed in always reads the database.
  if (req.method !== 'GET' || req.headers.authorization || TTL <= 0) return next();
  const key = req.originalUrl;
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    res.set('X-Cache', 'HIT');
    return res.status(200).json(hit.body);
  }
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
      store.set(key, { body, expires: Date.now() + TTL });
    }
    res.set('X-Cache', 'MISS');
    return json(body);
  };
  return next();
}

/** Any successful change (add, edit, delete, settings, upload...) empties the cache. */
function clearOnChange(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.on('finish', () => { if (res.statusCode < 400) clear(); });
  }
  next();
}

module.exports = { cachePublicGets, clearOnChange, clear };
