const express = require('express');
const rateLimit = require('express-rate-limit');
const models = require('../models');
const { crud, wrap, pick } = require('./crud');
const { signToken, requireAuth, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const { User, Program, Service, TeamMember, Partner, Testimonial, Post, Job, GalleryItem, Event, Message, Subscriber, Setting } = models;
const router = express.Router();

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Try again in 15 minutes.' },
});

router.post('/auth/login', loginLimiter, wrap(async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user || !user.active || !(await user.checkPassword(password))) {
    return res.status(401).json({ message: 'The email or password is not correct.' });
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.get('/auth/me', requireAuth, (req, res) => res.json(req.user));

router.put('/auth/password', requireAuth, wrap(async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.user.id);
  const next = String(req.body.newPassword || '');
  if (!(await user.checkPassword(String(req.body.currentPassword || '')))) {
    return res.status(400).json({ message: 'Your current password is not correct.' });
  }
  if (next.length < 8) return res.status(400).json({ message: 'Use at least 8 characters for the new password.' });
  user.password = next;
  await user.save();
  res.json({ message: 'Password changed.' });
}));

/* ------------------------------------------------------------------ */
/* Website content                                                     */
/* ------------------------------------------------------------------ */
router.use('/programs', crud(Program, {
  hasSlug: true,
  fields: ['title', 'slug', 'category', 'summary', 'description', 'topics', 'duration', 'fee', 'level', 'image', 'sortOrder', 'published'],
}));
router.use('/services', crud(Service, {
  fields: ['title', 'summary', 'description', 'image', 'status', 'sortOrder', 'published'],
}));
router.use('/team', crud(TeamMember, {
  fields: ['name', 'role', 'bio', 'photo', 'linkedin', 'sortOrder', 'published'],
}));
router.use('/partners', crud(Partner, {
  fields: ['name', 'logo', 'website', 'sortOrder', 'published'],
}));
router.use('/testimonials', crud(Testimonial, {
  fields: ['name', 'program', 'content', 'photo', 'sortOrder', 'published'],
}));
router.use('/posts', crud(Post, {
  hasSlug: true,
  order: [['publishedAt', 'DESC'], ['id', 'DESC']],
  fields: ['title', 'slug', 'excerpt', 'content', 'cover', 'author', 'publishedAt', 'published'],
  beforeSave: (data, existing) => {
    // Stamp the publication date the first time a post goes live.
    if (data.published && !data.publishedAt && !(existing && existing.publishedAt)) data.publishedAt = new Date();
  },
}));
router.use('/jobs', crud(Job, {
  order: [['createdAt', 'DESC']],
  fields: ['title', 'department', 'type', 'location', 'description', 'requirements', 'howToApply', 'deadline', 'published'],
}));

router.use('/gallery', crud(GalleryItem, {
  fields: ['title', 'image', 'album', 'sortOrder', 'published'],
}));
router.use('/events', crud(Event, {
  hasSlug: true,
  order: [['startsAt', 'DESC']],
  fields: ['title', 'slug', 'summary', 'description', 'location', 'startsAt', 'endsAt', 'image', 'published'],
}));

/* ------------------------------------------------------------------ */
/* Settings (contact details, social links, homepage texts)            */
/* ------------------------------------------------------------------ */
router.get('/settings', wrap(async (req, res) => {
  const rows = await Setting.findAll();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value || ''])));
}));
router.get('/settings/all', requireAuth, wrap(async (req, res) => {
  res.json(await Setting.findAll({ order: [['group', 'ASC'], ['sortOrder', 'ASC']] }));
}));
router.put('/settings', requireAuth, wrap(async (req, res) => {
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    // eslint-disable-next-line no-await-in-loop
    await Setting.update({ value: clean(value, 5000) }, { where: { key } });
  }
  res.json({ message: 'Settings saved.' });
}));

/* ------------------------------------------------------------------ */
/* Contact form and newsletter                                         */
/* ------------------------------------------------------------------ */
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'You have sent several messages already. Try again in an hour.' },
});

router.post('/contact', formLimiter, wrap(async (req, res) => {
  // "website" is a hidden field real visitors never fill in. Bots do.
  if (req.body.website) return res.status(201).json({ message: 'Message sent.' });
  const data = {
    name: clean(req.body.name, 120),
    email: clean(req.body.email, 160).toLowerCase(),
    phone: clean(req.body.phone, 40) || null,
    company: clean(req.body.company, 160) || null,
    subject: clean(req.body.subject, 200),
    message: clean(req.body.message, 5000),
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Enter your name.';
  if (!isEmail(data.email)) errors.email = 'Enter a valid email address.';
  if (data.subject.length < 3) errors.subject = 'Enter a subject.';
  if (data.message.length < 10) errors.message = 'Write a message of at least 10 characters.';
  if (Object.keys(errors).length) return res.status(422).json({ message: 'Check the highlighted fields.', errors });
  await Message.create(data);
  res.status(201).json({ message: 'Message sent.' });
}));

router.post('/subscribe', formLimiter, wrap(async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  if (!isEmail(email)) return res.status(422).json({ message: 'Enter a valid email address.' });
  await Subscriber.findOrCreate({ where: { email } });
  res.status(201).json({ message: 'Subscribed.' });
}));

router.get('/messages', requireAuth, wrap(async (req, res) => {
  res.json(await Message.findAll({ order: [['createdAt', 'DESC']] }));
}));
router.put('/messages/:id', requireAuth, wrap(async (req, res) => {
  const item = await Message.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found.' });
  await item.update({ isRead: Boolean(req.body.isRead) });
  res.json(item);
}));
router.delete('/messages/:id', requireAuth, wrap(async (req, res) => {
  await Message.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Deleted.' });
}));

router.get('/subscribers', requireAuth, wrap(async (req, res) => {
  res.json(await Subscriber.findAll({ order: [['createdAt', 'DESC']] }));
}));
router.delete('/subscribers/:id', requireAuth, wrap(async (req, res) => {
  await Subscriber.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Deleted.' });
}));

/* ------------------------------------------------------------------ */
/* Admin users (administrators only)                                   */
/* ------------------------------------------------------------------ */
router.get('/users', requireAuth, requireAdmin, wrap(async (req, res) => res.json(await User.findAll({ order: [['id', 'ASC']] }))));
router.post('/users', requireAuth, requireAdmin, wrap(async (req, res) => {
  const data = pick(req.body, ['name', 'email', 'password', 'role', 'active']);
  if (!data.name || !isEmail(data.email)) return res.status(422).json({ message: 'Enter a name and a valid email address.' });
  if (!data.password || String(data.password).length < 8) return res.status(422).json({ message: 'Use at least 8 characters for the password.' });
  data.email = String(data.email).toLowerCase();
  const user = await User.create(data);
  res.status(201).json(await User.findByPk(user.id));
}));
router.put('/users/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'Not found.' });
  const data = pick(req.body, ['name', 'email', 'password', 'role', 'active']);
  if (!data.password) delete data.password; // blank = keep the current password
  else if (String(data.password).length < 8) return res.status(422).json({ message: 'Use at least 8 characters for the password.' });
  if (data.email) data.email = String(data.email).toLowerCase();
  if (user.id === req.user.id && (data.role === 'editor' || data.active === false)) {
    return res.status(400).json({ message: 'You cannot remove your own administrator access.' });
  }
  await user.update(data);
  res.json(await User.findByPk(user.id));
}));
router.delete('/users/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ message: 'You cannot delete your own account.' });
  await User.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Deleted.' });
}));

/* ------------------------------------------------------------------ */
/* Image upload and dashboard numbers                                  */
/* ------------------------------------------------------------------ */
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose an image to upload.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

router.get('/stats', requireAuth, wrap(async (req, res) => {
  const [programs, services, team, partners, testimonials, posts, jobs, messages, unread, subscribers, gallery, events] = await Promise.all([
    Program.count(), Service.count(), TeamMember.count(), Partner.count(), Testimonial.count(),
    Post.count(), Job.count(), Message.count(), Message.count({ where: { isRead: false } }), Subscriber.count(), GalleryItem.count(), Event.count(),
  ]);
  const latest = await Message.findAll({ order: [['createdAt', 'DESC']], limit: 5 });
  res.json({ programs, services, team, partners, testimonials, posts, jobs, messages, unread, subscribers, gallery, events, latest });
}));

router.get('/health', (req, res) => res.json({ ok: true }));

module.exports = router;
