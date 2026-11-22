const app = require('./app');
const { sequelize, ensureDatabase, explain } = require('./config/db');
const { ensureColumns } = require('./models');

const PORT = Number(process.env.PORT) || 5000;

(async () => {
  try {
    await ensureDatabase();
    await sequelize.authenticate();
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
