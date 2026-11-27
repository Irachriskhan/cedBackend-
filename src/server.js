const app = require('./app');
const { sequelize, ensureDatabase, explain } = require('./config/db');
const { ensureColumns } = require('./models');

const PORT = Number(process.env.PORT) || 5000;

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** The database may be briefly unreachable when the server starts (e.g. Render waking up). Try a few times. */
async function connectWithRetry(attempts = 6) {
  for (let i = 1; ; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ensureDatabase();
      // eslint-disable-next-line no-await-in-loop
      await sequelize.authenticate();
      return;
    } catch (err) {
      const advice = explain(err);
      const permanent = advice && /rejected the user|not allowed/.test(advice);
      if (permanent || i >= attempts) throw err;
      console.warn(`Database not reachable yet (attempt ${i} of ${attempts}): ${err.message}. Trying again...`);
      // eslint-disable-next-line no-await-in-loop
      await wait(Math.min(2000 * i, 10000));
    }
  }
}

// Log problems instead of letting one stray error stop the whole server.
process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));

(async () => {
  try {
    await connectWithRetry();
    await sequelize.sync(); // creates missing tables, never drops data
    await ensureColumns();
    app.listen(PORT, () => {
      console.log(`CED API running at http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('\nCould not start the API.');
    console.error(explain(err) || err.message);
    process.exit(1);
  }
})();
