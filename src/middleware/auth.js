const jwt = require('jsonwebtoken');
const { User } = require('../models');

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is missing from backend/.env');
  return s;
};

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

/** Requires a valid "Authorization: Bearer <token>" header. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' });
    const payload = jwt.verify(token, secret());
    const user = await User.findByPk(payload.id);
    if (!user || !user.active) return res.status(401).json({ message: 'This account is no longer active.' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Your session has expired. Sign in again.' });
  }
}

const requireAdmin = (req, res, next) =>
  req.user && req.user.role === 'admin'
    ? next()
    : res.status(403).json({ message: 'Only an administrator can do this.' });

module.exports = { signToken, requireAuth, requireAdmin };
