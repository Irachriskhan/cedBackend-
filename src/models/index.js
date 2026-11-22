const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');

const str = (len = 255, extra = {}) => ({ type: DataTypes.STRING(len), ...extra });
const text = (extra = {}) => ({ type: DataTypes.TEXT, ...extra });
const order = { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 };
const flag = (def = true) => ({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: def });

/* ---------- Admin users ---------- */
const User = sequelize.define(
  'User',
  {
    name: str(120, { allowNull: false }),
    email: str(160, { allowNull: false, unique: true, validate: { isEmail: true } }),
    password: str(255, { allowNull: false }),
    role: { type: DataTypes.ENUM('admin', 'editor'), allowNull: false, defaultValue: 'editor' },
    active: flag(true),
  },
  {
    tableName: 'users',
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { withPassword: {} },
  }
);
const hashPassword = async (user) => {
  if (user.changed('password')) user.password = await bcrypt.hash(user.password, 10);
};
User.beforeCreate(hashPassword);
User.beforeUpdate(hashPassword);
User.prototype.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

/* ---------- Website content ---------- */
const Program = sequelize.define(
  'Program',
  {
    title: str(160, { allowNull: false }),
    slug: str(190, { allowNull: false, unique: true }),
    category: str(80), // used by the filter buttons on the Programmes page
    summary: str(400),
    description: text(),
    topics: text(), // one topic per line
    duration: str(80),
    fee: str(120),
    level: str(80),
    image: str(500),
    sortOrder: order,
    published: flag(true),
  },
  { tableName: 'programs' }
);

const Service = sequelize.define(
  'Service',
  {
    title: str(160, { allowNull: false }),
    summary: str(400),
    description: text(),
    image: str(500),
    status: { type: DataTypes.ENUM('active', 'upcoming'), allowNull: false, defaultValue: 'active' },
    sortOrder: order,
    published: flag(true),
  },
  { tableName: 'services' }
);

const TeamMember = sequelize.define(
  'TeamMember',
  {
    name: str(120, { allowNull: false }),
    role: str(160, { allowNull: false }),
    bio: text(),
    photo: str(500),
    linkedin: str(),
    sortOrder: order,
    published: flag(true),
  },
  { tableName: 'team_members' }
);

const Partner = sequelize.define(
  'Partner',
  {
    name: str(160, { allowNull: false }),
    logo: str(500),
    website: str(),
    sortOrder: order,
    published: flag(true),
  },
  { tableName: 'partners' }
);

const Testimonial = sequelize.define(
  'Testimonial',
  {
    name: str(120, { allowNull: false }),
    program: str(160),
    content: text({ allowNull: false }),
    photo: str(500),
    sortOrder: order,
    published: flag(true),
  },
  { tableName: 'testimonials' }
);

const Post = sequelize.define(
  'Post',
  {
    title: str(200, { allowNull: false }),
    slug: str(190, { allowNull: false, unique: true }),
    excerpt: str(500),
    content: text({ allowNull: false }),
    cover: str(500),
    author: str(120),
    publishedAt: { type: DataTypes.DATE },
    published: flag(false),
  },
  { tableName: 'posts' }
);

const Job = sequelize.define(
  'Job',
  {
    title: str(200, { allowNull: false }),
    department: str(120),
    type: str(80), // Full-time, Volunteer, Internship...
    location: str(160),
    description: text({ allowNull: false }),
    requirements: text(), // one per line
    howToApply: text(),
    deadline: { type: DataTypes.DATEONLY },
    published: flag(true),
  },
  { tableName: 'jobs' }
);

const GalleryItem = sequelize.define(
  'GalleryItem',
  {
    title: str(200, { allowNull: false }),
    image: str(500, { allowNull: false }),
    album: str(120), // used for the filter buttons, e.g. "Graduation"
    sortOrder: order,
    published: flag(true),
  },
  { tableName: 'gallery_items' }
);

const Event = sequelize.define(
  'Event',
  {
    title: str(200, { allowNull: false }),
    slug: str(190, { allowNull: false, unique: true }),
    summary: str(400),
    description: text(),
    location: str(200),
    startsAt: { type: DataTypes.DATE, allowNull: false },
    endsAt: { type: DataTypes.DATE },
    image: str(500),
    published: flag(true),
  },
  { tableName: 'events' }
);

/* ---------- Things visitors send us ---------- */
const Message = sequelize.define(
  'Message',
  {
    name: str(120, { allowNull: false }),
    email: str(160, { allowNull: false, validate: { isEmail: true } }),
    phone: str(40),
    company: str(160),
    subject: str(200, { allowNull: false }),
    message: text({ allowNull: false }),
    isRead: flag(false),
  },
  { tableName: 'messages' }
);

const Subscriber = sequelize.define(
  'Subscriber',
  { email: str(160, { allowNull: false, unique: true, validate: { isEmail: true } }) },
  { tableName: 'subscribers' }
);

/* ---------- Site-wide settings (contact details, links, texts) ---------- */
const Setting = sequelize.define(
  'Setting',
  {
    key: str(80, { allowNull: false, unique: true }),
    value: text(),
    label: str(160),
    group: str(60, { defaultValue: 'general' }),
    sortOrder: order,
  },
  { tableName: 'settings' }
);

/**
 * sequelize.sync() creates missing tables but never adds a column to a table that
 * already exists. Columns added after the first release are listed here and added
 * when they are missing, so an existing database keeps working after an update.
 */
async function ensureColumns() {
  const qi = sequelize.getQueryInterface();
  const added = [[Program, 'category'], [Job, 'department']];
  // Image columns were 255 characters in the first version; pasted image addresses can be longer.
  const widened = [[Program, 'image'], [Service, 'image'], [TeamMember, 'photo'], [Partner, 'logo'], [Testimonial, 'photo'], [Post, 'cover']];
  const tables = {};
  const describe = async (Model) => {
    const name = Model.getTableName();
    if (!tables[name]) tables[name] = await qi.describeTable(name);
    return tables[name];
  };
  for (const [Model, column] of added) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await describe(Model))[column]) await qi.addColumn(Model.getTableName(), column, Model.rawAttributes[column]);
  }
  for (const [Model, column] of widened) {
    // eslint-disable-next-line no-await-in-loop
    const info = (await describe(Model))[column];
    const length = info && Number((String(info.type).match(/\((\d+)\)/) || [])[1]);
    if (length && length < 500) {
      const { type, allowNull } = Model.rawAttributes[column];
      // eslint-disable-next-line no-await-in-loop
      await qi.changeColumn(Model.getTableName(), column, { type, allowNull });
    }
  }
}

module.exports = {
  sequelize,
  ensureColumns,
  User,
  Program,
  Service,
  TeamMember,
  Partner,
  Testimonial,
  Post,
  Job,
  GalleryItem,
  Event,
  Message,
  Subscriber,
  Setting,
};
