/**
 * Loads backend/.env. If the file does not exist yet it is created from
 * .env.example with a random JWT secret, so the project runs straight away.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '..', '.env');
const examplePath = path.join(__dirname, '..', '..', '.env.example');
const newSecret = () => crypto.randomBytes(48).toString('hex');

try {
  if (!fs.existsSync(envPath)) {
    const example = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, 'utf8') : '';
    const content = /^JWT_SECRET=.*$/m.test(example)
      ? example.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${newSecret()}`)
      : `${example}\nJWT_SECRET=${newSecret()}\n`;
    fs.writeFileSync(envPath, content);
    console.log('Created backend/.env with a new JWT secret.');
  }
} catch (err) {
  console.warn('Could not create backend/.env:', err.message);
}

require('dotenv').config({ path: envPath });

// An existing .env without a usable secret: add one so sign-in works.
const placeholder = 'replace-this-with-a-long-random-string';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === placeholder) {
  const secret = newSecret();
  process.env.JWT_SECRET = secret;
  try {
    const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const next = /^JWT_SECRET=.*$/m.test(current)
      ? current.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`)
      : `${current.replace(/\s*$/, '')}\nJWT_SECRET=${secret}\n`;
    fs.writeFileSync(envPath, next);
    console.log('Added a JWT secret to backend/.env.');
  } catch (err) {
    console.warn('Using a temporary JWT secret (could not write backend/.env).');
  }
}
