require('./config/env');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const files = require('./routes/files');
const { cachePublicGets, clearOnChange } = require('./middleware/cache');
const { isConnectionError } = require('./config/db');

const app = express();

const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/uploads', files);
app.use('/api', clearOnChange, cachePublicGets, routes);
app.use('/api', (req, res) => res.status(404).json({ message: 'This address does not exist.' }));

// Optional: serve the built website from this server too. The website lives in its
// own repository; set FRONTEND_DIST in .env to the full path of its "dist" folder
// (made with "npm run build" in the frontend) to use one server for both.
const dist = process.env.FRONTEND_DIST && path.resolve(process.env.FRONTEND_DIST);
if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({ name: 'CED API', ok: true, docs: 'See README.md' }));
}

// Errors end up here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const first = err.errors && err.errors[0];
    const message = err.name === 'SequelizeUniqueConstraintError'
      ? `That ${first ? first.path : 'value'} is already in use.`
      : `Check the "${first ? first.path : 'form'}" field.`;
    return res.status(422).json({ message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'The image is larger than 4 MB.' });
  if (isConnectionError(err)) {
    // Temporary: the database is busy or the connection dropped. The website retries by itself.
    console.warn(`Database unavailable for ${req.method} ${req.originalUrl}: ${err.message}`);
    res.set('Retry-After', '2');
    return res.status(503).json({ message: 'The database is busy. Try again in a moment.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Something went wrong on the server.' : err.message });
});

module.exports = app;
