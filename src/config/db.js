require('./env');
const { Sequelize } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'mysql';

const settings = {
  name: process.env.DB_NAME || 'ced_website',
  user: process.env.DB_USER || 'root',
  // XAMPP's MySQL has no password for "root" by default, so an empty value is normal here.
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
};

const sequelize =
  dialect === 'sqlite'
    ? // Only used for quick local tests without MySQL.
      new Sequelize({ dialect: 'sqlite', storage: process.env.DB_STORAGE || ':memory:', logging: false })
    : new Sequelize(settings.name, settings.user, settings.password, {
        host: settings.host,
        port: settings.port,
        dialect: 'mysql',
        logging: false,
        define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
        dialectOptions: {
          charset: 'utf8mb4',
          connectTimeout: 20000,
          // Keeps connections over a long network path (e.g. Render -> Hostinger) from going stale.
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
        },
        // Shared MySQL hosting (Hostinger) allows only a few connections per database user.
        // Keep the pool small: extra requests wait their turn instead of being refused.
        // Idle connections are closed quickly, before the host closes them for us.
        pool: {
          max: Number(process.env.DB_POOL_MAX) || 3,
          min: 0,
          idle: 5000,
          evict: 2000,
          acquire: 60000,
        },
        // A query that hits a dropped or refused connection is tried again on a fresh one.
        retry: {
          max: 4,
          backoffBase: 300,
          backoffExponent: 1.6,
          match: [
            /ECONNRESET/, /ECONNREFUSED/, /ETIMEDOUT/, /EPIPE/, /PROTOCOL_CONNECTION_LOST/,
            /Connection lost/i, /closed the connection/i, /Too many connections/i, /max_user_connections/i,
            /ER_USER_LIMIT_REACHED/, /ER_CON_COUNT_ERROR/, /Can't add new command when connection is in closed state/i,
            'SequelizeConnectionError', 'SequelizeConnectionRefusedError', 'SequelizeConnectionTimedOutError',
            'SequelizeConnectionAcquireTimeoutError',
          ],
        },
      });

/** Creates the MySQL database if it does not exist yet, so nothing has to be made by hand in phpMyAdmin. */
async function ensureDatabase() {
  if (dialect !== 'mysql') return;
  // On shared hosting the database is created in the control panel and the user may not be
  // allowed to list or create databases. Set DB_CREATE=false in that case.
  if (process.env.DB_CREATE === 'false') return;
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: settings.host, port: settings.port, user: settings.user, password: settings.password,
  });
  try {
    const name = settings.name.replace(/`/g, '');
    const [rows] = await connection.query('SHOW DATABASES LIKE ?', [name]);
    if (rows.length === 0) {
      await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`Created database "${name}".`);
    }
  } finally {
    await connection.end();
  }
}

/** Turns a connection problem into advice a person can act on. */
function explain(err) {
  const code = (err.original && err.original.code) || (err.parent && err.parent.code) || err.code;
  if (code === 'ECONNREFUSED') {
    return `MySQL is not reachable at ${settings.host}:${settings.port}. Open the XAMPP Control Panel and click Start next to MySQL, then run this again. If XAMPP shows a different port for MySQL, put that number in DB_PORT in .env.`;
  }
  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return `MySQL rejected the user "${settings.user}". With XAMPP the user is normally "root" with an empty password: set DB_USER=root and leave DB_PASSWORD= empty in .env. If you gave root a password in phpMyAdmin, put that password in DB_PASSWORD.`;
  }
  if (code === 'ER_BAD_DB_ERROR') return `The database "${settings.name}" does not exist. Run "npm run seed" to create it.`;
  if (code === 'ER_DBACCESS_DENIED_ERROR') return `The user "${settings.user}" is not allowed to use the database "${settings.name}". Use the "root" user, or give this user rights on the database in phpMyAdmin.`;
  return null;
}

/** True for errors that mean "the database could not be reached right now", not "the query was wrong". */
function isConnectionError(err) {
  const names = ['SequelizeConnectionError', 'SequelizeConnectionRefusedError', 'SequelizeConnectionTimedOutError',
    'SequelizeConnectionAcquireTimeoutError', 'SequelizeHostNotReachableError', 'SequelizeAccessDeniedError'];
  const text = `${err && err.name} ${err && err.message} ${err && err.original && err.original.code}`;
  return names.includes(err && err.name)
    || /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|PROTOCOL_CONNECTION_LOST|Connection lost|closed the connection|Too many connections|max_user_connections|ER_USER_LIMIT_REACHED|ER_CON_COUNT_ERROR/i.test(text);
}

module.exports = { sequelize, ensureDatabase, explain, isConnectionError };
