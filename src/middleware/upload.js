const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Older uploads (and local development) may still be files in this folder.
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
// CED photos that ship with the project. They are part of the repository, so they
// are always present on the server, even right after a redeploy.
const seedImagesDir = path.join(__dirname, '..', '..', 'seed-images');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch { /* read-only disk: fine, uploads go to the database */ }

const allowed = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX_MB = Number(process.env.UPLOAD_MAX_MB) || 4;

// Files are kept in memory only until they are saved to the database.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    allowed[file.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Upload a JPG, PNG, WEBP or GIF image.'), { status: 400 })),
});

/** A new, safe file name. The original name is never trusted. */
const newName = (mime) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${allowed[mime]}`;

const mimeFromName = (name) => ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' })[path.extname(name).toLowerCase()];

module.exports = { upload, uploadDir, seedImagesDir, newName, mimeFromName, MAX_MB };
