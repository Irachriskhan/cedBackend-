# CED backend

The API for the **Community Engaged for Development (CED)** website: Node.js, Express, Sequelize and MySQL (XAMPP).

The website itself is in its own repository, [cedPioneersFrontend](https://github.com/Irachriskhan/cedPioneersFrontend). It talks to this API, so run this first.

## What you need

- [Node.js](https://nodejs.org) 18 or newer
- [XAMPP](https://www.apachefriends.org) (only its MySQL is used)

## Run it on your computer

**1. Start MySQL.** Open the XAMPP Control Panel and click **Start** next to **MySQL**. Apache is only needed if you want to look at the data in phpMyAdmin.

**2. Install and set up.** In a terminal, inside this folder:

```bash
npm install
npm run seed
npm run dev
```

- `npm run seed` creates `.env`, the `ced_website` database, its tables, the starting content and the first admin account. You do not need to create anything in phpMyAdmin.
- `npm run dev` starts the API on http://localhost:5000/api and restarts it when you change a file.

The settings in `.env` already match XAMPP's defaults:

| Setting | XAMPP value |
|---|---|
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` (or the port XAMPP shows next to MySQL) |
| `DB_NAME` | `ced_website` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | empty, unless you gave `root` a password in phpMyAdmin |

`JWT_SECRET` is filled in with a random value on the first run. Leave it alone; changing it signs everyone out.

**3. Start the website** from the frontend repository (see its README) and open http://localhost:5173.

## Admin sign-in

Open http://localhost:5173/admin and sign in with:

- Email: `admin@cedpioneers.com`
- Password: `ChangeMe@2026`

Change the password under **My account** after the first sign-in. To use a different first account, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before running `npm run seed`.

## If something goes wrong

| Message | What to do |
|---|---|
| MySQL is not reachable at 127.0.0.1:3306 | Start MySQL in the XAMPP Control Panel. If XAMPP shows another port, put it in `DB_PORT`. |
| MySQL rejected the user "root" | Set `DB_USER=root` and leave `DB_PASSWORD=` empty, or use the password you set in phpMyAdmin. |
| 503 "The database is busy" | The database refused or dropped the connection. Lower `DB_POOL_MAX` to 2, close phpMyAdmin, and check Hostinger's Remote MySQL allows `%`. |
| Port 5000 is already in use | Another copy of the API is running. Close it, or set another `PORT` in `.env` (and change `vite.config.js` in the frontend to match). |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API and restart on changes |
| `npm start` | Start the API (for a server) |
| `npm run seed` | Add starting content to empty tables, and update a database made by an earlier version. Safe to run again: it never overwrites anything you edited. |
| `npm run seed:fresh` | **Deletes all content** and starts again |

## Photos and sample content

- **CED photos** in `seed-images/` (the ICT class, the English class, Master Project Pitching and the three founders) are copied into `uploads/` by `npm run seed`.
- **Placeholder photos** from picsum.photos remain on programmes that have no CED photo yet.
- **Sample content** with "Sample" in the title (3 events, 1 news article) shows how those pages look.

Replace the placeholders and samples in the admin area before going live.

**Back up two things:** the `ced_website` database (phpMyAdmin > Export, or `mysqldump`) and the `uploads/` folder. Uploaded images are not stored in Git.

## Updating from an earlier version

Run `npm install`, then `npm run seed`, then `npm run dev`. The update adds any missing tables and columns to your existing `ced_website` database and keeps your content.

If you used the PostgreSQL version for a while, content added there stays in PostgreSQL. This version starts from the MySQL database in XAMPP.

## Project layout

```
src/
  server.js          Starts the API
  app.js             Express setup, security headers, CORS
  config/env.js      Loads .env (and creates it on first run)
  config/db.js       MySQL connection
  models/index.js    Database tables
  routes/index.js    All API addresses
  routes/crud.js     Shared list / add / edit / delete logic
  middleware/        Sign-in check, image upload
  seed/seed.js       Starting content
seed-images/         CED photos used by the seed command
uploads/             Uploaded images (not in Git)
```

## API overview

Public: `GET /api/programs`, `/services`, `/team`, `/partners`, `/testimonials`, `/posts`, `/jobs`, `/gallery`, `/events`, `/settings`, and one item at `GET /api/<type>/<id or slug>`. Visitors can `POST /api/contact` and `POST /api/subscribe`.

Admin (needs the sign-in token): `POST /api/auth/login`, then `POST`, `PUT /:id` and `DELETE /:id` on each content type, `GET /api/<type>/all`, `/messages`, `/subscribers`, `/users`, `/stats`, `PUT /api/settings` and `POST /api/upload`.

## Hosting on Render with a Hostinger database

On Render, open the service > **Environment** and set:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_URL` | the website's address, with and without `www`, e.g. `https://cedpioneers.com,https://www.cedpioneers.com` |
| `DB_HOST` | the MySQL host shown in Hostinger (hPanel > Databases) |
| `DB_PORT` | `3306` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | the database, user and password created in Hostinger |
| `DB_CREATE` | `false` (the database already exists in Hostinger) |
| `DB_POOL_MAX` | `3` |

Also on Render, set **Health Check Path** to `/api/health`. In Hostinger, under **Remote MySQL**, allow access from any host (`%`), because Render's addresses change.

Hostinger's shared MySQL allows only a few connections per database user, and the trip from Render to Hostinger adds delay. So the API:

- keeps at most `DB_POOL_MAX` connections open (keep it at 3, or 2 if errors continue; extra requests wait their turn instead of failing)
- retries a query once its connection drops or is refused
- keeps public data in memory for `CACHE_SECONDS` (60 by default), so most visits don't touch the database at all; any save in the admin area clears it at once
- answers `503 The database is busy` only if the database stays unreachable, and the website retries those requests by itself

Keep phpMyAdmin closed while testing the live site: each phpMyAdmin tab uses one of the same few connections.

## Putting it online

1. On the server, create `.env` with the real database details, `NODE_ENV=production`, and `CLIENT_URL` set to the website's address (for example `https://www.cedpioneers.com`).
2. Run `npm install --omit=dev`, `npm run seed`, then `npm start`. Keep it running with a process manager such as PM2, behind HTTPS.
3. Build the frontend with `VITE_API_URL` set to this API's address.

To serve the website from this same server instead, build the frontend and set `FRONTEND_DIST` in `.env` to the full path of its `dist` folder.
