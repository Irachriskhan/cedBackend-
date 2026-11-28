/**
 * Fills the database with CED's starting content and creates the first admin account.
 *
 *   npm run seed         adds content only to tables that are still empty
 *   npm run seed:fresh   DELETES everything and starts again
 */
require('../config/env');
const { sequelize, ensureDatabase, explain } = require('../config/db');
const { ensureColumns, User, Program, Service, TeamMember, Partner, Testimonial, Setting, Post, GalleryItem, Event } = require('../models');

/*
 * Placeholder photos. These are generic stock pictures from picsum.photos, loaded
 * from the internet, so the site does not look empty. They do NOT show CED.
 * Replace each one with a real photo in the admin area.
 */
const photo = (name, w = 1200, h = 800) => `https://picsum.photos/seed/ced-${name}/${w}/${h}`;

/* Real CED photos shipped with the project, in seed-images/. The API serves them
   at /uploads/ced-<file> straight from that folder, so nothing needs copying. */
const fs = require('fs');
const path = require('path');
const seedImages = path.join(__dirname, '..', '..', 'seed-images');
const real = (file) => (fs.existsSync(path.join(seedImages, file)) ? `/uploads/ced-${file}` : null);
const IMG = {
  ict: real('ict-course.webp'),
  english: real('english-level-b.webp'),
  pitching: real('master-project-pitching.webp'),
  notes: real('course-notes.jpg'),
};
const inDays = (n, hour = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };

const fresh = process.argv.includes('--fresh');
const lines = (arr) => arr.join('\n');

const settings = [
  // --- general
  ['site_name', 'Community Engaged for Development', 'Organisation name', 'general'],
  ['short_name', 'CED', 'Short name', 'general'],
  ['tagline', 'Ignite Your Potential', 'Tagline', 'general'],
  ['announcement', '', 'Announcement bar at the top of every page (leave empty to hide)', 'general'],
  ['elearning_url', 'https://www.cedpioneers.com/slides', 'Link to the e-learning platform', 'general'],

  // --- home page
  ['hero_title', 'We deliver online and onsite training to you', 'Home: main headline', 'home'],
  ['hero_text', 'CED is a refugee-led organisation in Mahama Refugee Camp, Rwanda. We train youth, women and business owners in ICT, English and digital business, and help local businesses start selling online.', 'Home: text under the headline', 'home'],
  ['intro_title', 'Founded in the camp, by people who live there', 'Home: introduction title', 'home'],
  ['intro_text', 'CED started in March 2023, when graduates of the Digital Career Counselors programme decided to pass on what they had learned. Our courses are designed around the professional development of refugee youth and their neighbours in the host community, for beginner and intermediate learners, on site in Mahama and online.', 'Home: introduction text', 'home'],

  ['hero_image', IMG.ict, 'Home: sliding background photo 1 (wide photos work best)', 'home'],
  ['hero_image_2', IMG.english, 'Home: sliding background photo 2 (leave empty to skip)', 'home'],
  ['hero_image_3', IMG.notes, 'Home: sliding background photo 3 (leave empty to skip)', 'home'],
  ['about_image', IMG.english, 'Home and About: photo next to the introduction', 'home'],

  ['unlock_title', 'Unlock your potential with our training', 'Home: title of the online learning block', 'home'],
  ['unlock_text', 'We offer English, digital business, digital literacy and computer programmes for beginner and intermediate learners. Explore training crafted to build your skills and improve your business or career prospects.', 'Home: text of the online learning block', 'home'],
  ['unlock_image', IMG.notes, 'Home: photo of the online learning block', 'home'],

  // --- about
  ['mission', 'To promote economic inclusion for refugees and host communities through high-quality digital training, applied research and business tools, so that people can start sustainable businesses or find meaningful work.', 'Mission', 'about'],
  ['vision', 'A lasting ecosystem where education and business opportunities drive economic growth, innovation, social integration and sustainable livelihoods for refugee and host-community youth.', 'Vision', 'about'],
  ['purpose', 'To help refugee and host-community youth reach economic independence through practical skills, pathways to employment and digital business platforms that support local growth.', 'Purpose', 'about'],
  ['story', 'Community Engaged for Development (CED) was founded in March 2023 in Mahama Refugee Camp, Kirehe District, Rwanda, by graduates of the Digital Career Counselors programme. We are refugee-led: the people who run CED share the daily reality of the people we train.\n\nWe serve children, women, youth, persons with disabilities and small businesses, both refugees and members of the host community, in an underserved humanitarian setting.', 'Our story (blank line = new paragraph)', 'about'],
  ['toc_problem', 'Refugee youth have little access to quality education, jobs and business opportunities. The result is economic dependency and limited growth.', 'Theory of change: the problem', 'about'],
  ['toc_intervention', 'Accessible training in English, ICT and digital business, together with an e-commerce platform that lets individuals and businesses sell to customers and stimulate the local economy.', 'Theory of change: what we do', 'about'],
  ['toc_outcome', 'Youth become economically independent and contribute to job creation, economic growth and the digital transformation of businesses in refugee camps and host communities.', 'Theory of change: the outcome', 'about'],
  ['values', lines([
    'Empowerment: We give youth the knowledge and tools to take control of their future and build a sustainable livelihood.',
    'Innovation: We use technology to transform businesses, create opportunities and answer challenges specific to refugee communities.',
    'Inclusion: Our programmes and platforms are open to everyone, especially people with disabilities.',
    'Collaboration: We work with local businesses and the wider community to build one integrated support system.',
    'Sustainability: We aim for lasting impact through entrepreneurship, job creation, digital business and education.',
    'Integrity: We are transparent, accountable and ethical in everything we do.',
  ]), 'Core values (one per line, written as "Name: description")', 'about'],
  ['who_we_serve', lines(['Youth', 'Women', 'Children', 'Persons with disabilities', 'Small businesses']), 'Who we serve (one per line)', 'about'],

  // --- programmes
  ['eligibility', lines([
    'You are between 16 and 45 years old',
    'You have completed at least Primary Six (P6)',
    'You live in Mahama Refugee Camp or the surrounding host community',
    'For the coding courses: you have completed secondary school',
  ]), 'Who can join (one per line)', 'programmes'],
  ['certificate_note', 'Everyone who completes a course and meets its requirements receives a Certificate of Completion with a digital signature from CED.', 'Certificate note', 'programmes'],
  ['fees_note', 'Training is self-funded and can be paid in monthly instalments. There are no scholarships at the moment; we will announce them here if a sponsor makes them possible.', 'Fees note', 'programmes'],
  ['registration_note', '', 'Registration status, e.g. "Registration for Cohort 5 opens on 1 March" (leave empty to hide)', 'programmes'],

  // --- contact
  ['email', 'cedpioneers@gmail.com', 'Email address', 'contact'],
  ['phone', '+250 791 501 079', 'Phone number', 'contact'],
  ['coordinator_phone', '0727 973 384', 'Course coordinator phone', 'contact'],
  ['address', 'Mahama Digital Center, Mahama Refugee Camp, Kirehe District, Rwanda', 'Address', 'contact'],
  ['office_hours', '', 'Office hours (leave empty to hide)', 'contact'],
  ['map_embed_url', '', 'Google Maps embed link (leave empty to hide)', 'contact'],

  // --- social
  ['social_x', 'https://x.com/cedpioneers', 'X (Twitter) link', 'social'],
  ['social_linkedin', 'https://www.linkedin.com/company/cedpioneers', 'LinkedIn link', 'social'],
  ['social_facebook', '', 'Facebook link', 'social'],
  ['social_instagram', '', 'Instagram link', 'social'],
  ['social_youtube', '', 'YouTube link', 'social'],
];

const programs = [
  {
    title: 'Digital Literacy', slug: 'digital-literacy', category: 'Digital skills', image: photo('digital-literacy', 800, 500), level: 'Beginner',
    summary: 'The essential digital skills, from internet basics to finding your way around everyday online tools.',
    description: 'A first step for anyone who is new to computers and the internet. You learn to get online safely, search for information, communicate, and use the tools that work and study now depend on.',
    topics: lines(['Internet basics', 'Email and online communication', 'Everyday online tools', 'Staying safe online']),
  },
  {
    title: 'ICT Training', slug: 'ict-training', category: 'Digital skills', image: IMG.ict, level: 'Beginner', duration: '3 months', fee: '30,000 RWF (10,000 RWF per month)',
    summary: 'From basic computer operations to confident use of office applications.',
    description: 'Practical computer skills for study and the workplace. You work through office applications such as MS Office and Google Workspace, and learn how to keep a computer secure and running.\n\nThe online ICT course adds a broad introduction to information and communication technology: hardware, software, networks, the internet, digital communication, data security and ethics, and how new technology affects society.',
    topics: lines(['Computer basics', 'Word processing', 'Spreadsheets', 'Presentations', 'Online communication and collaboration', 'Computer security', 'Troubleshooting and maintenance']),
  },
  {
    title: 'ICT + Coding Basics', slug: 'ict-coding-basics', category: 'Software development', image: photo('ict-coding-basics', 800, 500), level: 'Beginner to intermediate', duration: '6 months', fee: '60,000 RWF (10,000 RWF per month)',
    summary: 'Everything in ICT Training, plus a first introduction to building for the web.',
    description: 'Start with the full ICT course, then move into the foundations of web design and development.',
    topics: lines(['All ICT Training content', 'HTML and CSS', 'Intermediate JavaScript', 'UI/UX design with Figma', 'Git and GitHub']),
  },
  {
    title: 'English Language', slug: 'english-language', category: 'Language', image: IMG.english, level: 'Level 1 and Level 2', duration: '3 months per level', fee: '21,000 RWF per level (7,000 RWF per month)',
    summary: 'Communication, grammar and practical language for your career and daily life.',
    description: 'Build the English you need to study, work and present yourself. The course strengthens speaking, writing and grammar, with practice in the kinds of writing employers expect.\n\n## Level A\n\nFor beginners with little or no English. You build basic vocabulary, grammar, pronunciation and conversation through texts, audio, video, exercises and quizzes.\n\n## Level B\n\nFor learners who already have basic English (A1 to A2). You improve reading, writing, speaking and listening, with a focus on fluency, confidence and the everyday expressions that make films, television and books easier to follow.',
    topics: lines(['Everyday and workplace communication', 'Grammar', 'Email writing', 'Presentations', 'Essay writing']),
  },
  {
    title: 'Digital Business', slug: 'digital-business', category: 'Business', image: IMG.notes, level: 'Beginner to intermediate',
    summary: 'Build, manage and grow a business online: e-commerce, digital marketing and business planning.',
    description: 'For business owners and people who want to start one. You learn how to bring a traditional business online, reach more customers and increase income.',
    topics: lines(['Digital literacy for business', 'E-commerce', 'Social media marketing', 'Content creation', 'Business planning and strategy']),
  },
  {
    title: 'Web Development: Front-End', slug: 'web-development-front-end', category: 'Software development', image: photo('web-development-front-end', 800, 500), level: 'Secondary school completed', duration: '6 months', fee: '120,000 RWF (20,000 RWF per month)',
    summary: 'Design and build responsive websites and web interfaces.',
    description: 'A software development track for learners who have completed secondary school. You learn to design and build the part of a website people see and use.',
    topics: lines(['HTML', 'CSS', 'JavaScript', 'ReactJS', 'Figma', 'Responsive web design']),
  },
  {
    title: 'Web Development: Full Stack', slug: 'web-development-full-stack', category: 'Software development', image: photo('web-development-full-stack', 800, 500), level: 'Secondary school completed', duration: '10 months', fee: '200,000 RWF (20,000 RWF per month)',
    summary: 'The complete path: front-end, back-end, databases and deployment.',
    description: 'Covers the whole Front-End track and continues into servers, databases and putting an application online.',
    topics: lines(['All Front-End content', 'Node.js and Express.js', 'MongoDB and MySQL', 'APIs', 'Deployment']),
  },
];

programs.splice(5, 0, {
  title: 'Master Project Pitching', slug: 'master-project-pitching', category: 'Business', image: IMG.pitching, level: 'Beginner to intermediate',
  summary: 'Learn to present a project so that partners, funders and customers say yes.',
  description: 'A course for entrepreneurs, people raising capital, and strategists, creatives or producers who need to win support for an idea. You learn how a pitch works from start to finish and practise delivering your own.',
  topics: lines(['The parts of a pitch and the pitch process', 'Structuring a pitch deck and ordering your slides', 'Building a persuasive story', 'Creating clear visual aids', 'Practising delivery', 'Using feedback to improve', 'Do\'s and don\'ts']),
});

const services = [
  {
    title: 'ICT Training',
    summary: 'Basic to advanced computer skills.',
    description: 'Trainees learn MS Office, Google Workspace, computer troubleshooting and the principles of cybersecurity.',
  },
  {
    title: 'English Language Training',
    summary: 'Stronger English for work, study and daily life.',
    description: 'We improve spoken communication and strengthen writing and grammar, including email writing, presentations and essays.',
  },
  {
    title: 'Digital Business',
    summary: 'Digital literacy and e-commerce skills for business owners.',
    description: 'Training in social media marketing, content creation and business strategy, so that a business becomes more visible and earns more.',
  },
  {
    title: 'Job Coaching',
    summary: 'Support for trainees on the way to employment.',
    description: 'Guidance for trainees preparing to look for work.',
  },
  {
    title: 'E-commerce platform', status: 'upcoming',
    summary: 'A marketplace that brings traditional businesses online.',
    description: 'We are building an e-commerce platform to help traditional businesses in the camp and host community move into the online marketplace. It aims to widen their reach, increase sales and create jobs for unemployed youth.',
  },
];

const team = [
  ['Dick Mugabo', 'Founder & Managing Director', real('dick-mugabo.webp')],
  ['Christophe Irakoze', 'Co-Founder & CTO', real('christophe-irakoze.webp')],
  ['Elysee N.', 'Co-Founder', real('elysee-niyo.webp')],
  ['Leilla Carmene N.', 'Project Manager'],
  ['Jean Bosco M.', 'Chief Financial Officer'],
  ['Cyprien Miburo', 'Human Resources'],
  ['Jean Ndayishimiye', 'Monitoring & Evaluation Officer'],
  ['Elie Niyonkuru', 'Information & Communication Officer'],
  ['Clovis Nziraguhindwa', 'Field Officer'],
  ['Adelin Bayubahe', 'Secretary'],
  ['Eliezer Kwizera', 'Advisor'],
];

const partners = ['UNHCR', 'Save the Children', 'Alight', 'Kumwe Hub', 'PFR', 'NABU'];

// Summaries of what trainees said on the previous website. Replace them with the
// trainees' exact words (and photos) in the admin area.
const testimonials = [
  ['Longman', 'ICT & English trainee', 'Before the course, Longman could not use a computer. He says he is now far more capable.'],
  ['Innocent Rukundo', 'Digital Business trainee', 'Innocent says the training showed him how to bring the internet into his business to increase his income.'],
  ['Hanadi Kamal', 'ICT trainee', 'Hanadi learned MS Word and Excel on the course, and says she can now apply for jobs online.'],
];

// Sample content, clearly marked, so the Media pages show their layout. Delete or replace it.
const gallery = [
  { title: 'ICT class at Mahama Digital Center', album: 'Training', image: IMG.ict },
  { title: 'English Level B class', album: 'Training', image: IMG.english },
  { title: 'Master Project Pitching', album: 'Events', image: IMG.pitching },
  { title: 'Course work', album: 'Training', image: IMG.notes },
].filter((g) => g.image).map((g, i) => ({ ...g, sortOrder: i + 1 }));
const events = [
  { title: 'Sample event: open day at Mahama Digital Center', slug: 'sample-open-day', location: 'Mahama Digital Center', startsAt: inDays(21), endsAt: inDays(21, 13), image: IMG.ict,
    summary: 'This is a sample event. Replace it with a real one in the admin area.', description: 'This is a sample event that shows how events look on the website.\n\nEdit or delete it under **Events** in the admin area.' },
  { title: 'Sample event: graduation ceremony', slug: 'sample-graduation', location: 'Mahama Refugee Camp', startsAt: inDays(45, 10), endsAt: inDays(45, 14), image: IMG.english,
    summary: 'This is a sample event. Replace it with a real one in the admin area.', description: 'This is a sample event that shows how events look on the website.' },
  { title: 'Sample past event: information session', slug: 'sample-info-session', location: 'Mahama Digital Center', startsAt: inDays(-30), endsAt: inDays(-30, 12), image: IMG.notes,
    summary: 'This is a sample event. Past events move to their own list automatically.', description: 'This is a sample event that shows how past events look on the website.' },
];
const posts = [
  { title: 'Sample article: welcome to the new CED website', slug: 'sample-welcome', author: 'CED', published: true, publishedAt: new Date(), cover: IMG.ict,
    excerpt: 'This is a sample article. Replace it with real news in the admin area.',
    content: 'This is a sample article that shows how news looks on the website.\n\n## Writing an article\n\nSign in to the admin area and open **News**. The buttons above the text box add:\n\n- headings\n- **bold text**\n- lists\n- links\n\nDelete this article when you publish your first real one.' },
];

async function fill(Model, rows, label) {
  if ((await Model.count()) > 0) return console.log(`  - ${label}: already has content, left as is`);
  await Model.bulkCreate(rows);
  console.log(`  + ${label}: ${rows.length} added`);
}

(async () => {
  try {
    await ensureDatabase();
    await sequelize.sync({ force: fresh });
    await ensureColumns();
    console.log(fresh ? 'Database emptied. Adding content:' : 'Adding content:');

    // Settings: add any key that is missing, never overwrite edited values.
    let added = 0;
    for (let i = 0; i < settings.length; i += 1) {
      const [key, value, label, group] = settings[i];
      // eslint-disable-next-line no-await-in-loop
      const [, created] = await Setting.findOrCreate({ where: { key }, defaults: { value, label, group, sortOrder: i } });
      if (created) added += 1;
      else await Setting.update({ label, sortOrder: i }, { where: { key } }); // eslint-disable-line no-await-in-loop
    }
    console.log(`  + settings: ${added} added`);

    await fill(Program, programs.map((p, i) => ({ ...p, sortOrder: i + 1 })), 'programmes');
    await fill(Service, services.map((s, i) => ({ ...s, sortOrder: i + 1 })), 'services');
    await fill(TeamMember, team.map(([name, role, photo], i) => ({ name, role, photo, sortOrder: i + 1 })), 'team');
    await fill(Partner, partners.map((name, i) => ({ name, sortOrder: i + 1 })), 'partners');
    await fill(Testimonial, testimonials.map(([name, program, content], i) => ({ name, program, content, sortOrder: i + 1 })), 'testimonials');

    await fill(GalleryItem, gallery, 'gallery');
    await fill(Event, events, 'events (samples)');
    await fill(Post, posts, 'news (sample)');

    // ---- Bring databases seeded by an earlier version up to date. ----
    // A value is only replaced when it is still empty, an online placeholder photo,
    // or the exact text an earlier version put there. Anything you edited is kept.
    const { Op } = require('sequelize');
    const stale = { [Op.or]: [{ [Op.is]: null }, '', { [Op.like]: 'https://picsum.photos/%' }] };
    const oldTexts = {
      hero_title: ['Skills, work and business for refugee and host-community youth.'],
    };
    let updated = 0;
    for (const [key, value] of settings) {
      if (!value) continue;
      const where = key.endsWith('_image') ? { key, value: stale } : oldTexts[key] ? { key, value: oldTexts[key] } : null;
      // eslint-disable-next-line no-await-in-loop
      if (where) updated += (await Setting.update({ value }, { where }))[0];
    }
    for (const p of programs) {
      // eslint-disable-next-line no-await-in-loop
      const [row, created] = await Program.findOrCreate({ where: { slug: p.slug }, defaults: { ...p, sortOrder: programs.indexOf(p) + 1 } });
      if (created) { updated += 1; continue; }
      const changes = {};
      if (!row.category && p.category) changes.category = p.category;
      if (p.image && (!row.image || row.image.startsWith('https://picsum.photos/')) && row.image !== p.image) changes.image = p.image;
      // Longer descriptions taken from the course catalogue replace the short first versions.
      if (row.description && p.description.startsWith(row.description) && row.description !== p.description) changes.description = p.description;
      if (Object.keys(changes).length) { await row.update(changes); updated += 1; } // eslint-disable-line no-await-in-loop
    }
    for (const [name, , photoPath] of team) {
      // eslint-disable-next-line no-await-in-loop
      if (photoPath) updated += (await TeamMember.update({ photo: photoPath }, { where: { name, photo: stale } }))[0];
    }
    // Swap the random sample gallery for the real photos.
    const removed = await GalleryItem.destroy({ where: { title: { [Op.like]: 'Sample photo %' }, image: { [Op.like]: 'https://picsum.photos/%' } } });
    if (removed) {
      for (const g of gallery) await GalleryItem.findOrCreate({ where: { image: g.image }, defaults: g }); // eslint-disable-line no-await-in-loop
      updated += removed;
    }
    const sampleCovers = [[Event, 'image', 'sample-open-day', IMG.ict], [Event, 'image', 'sample-graduation', IMG.english], [Event, 'image', 'sample-info-session', IMG.notes], [Post, 'cover', 'sample-welcome', IMG.ict]];
    for (const [Model, field, slug, value] of sampleCovers) {
      // eslint-disable-next-line no-await-in-loop
      if (value) updated += (await Model.update({ [field]: value }, { where: { slug, [field]: { [Op.like]: 'https://picsum.photos/%' } } }))[0];
    }
    if (updated) console.log(`  + updated ${updated} items with CED photos and website content`);

    const email = (process.env.ADMIN_EMAIL || 'admin@cedpioneers.com').toLowerCase();
    if (await User.findOne({ where: { email } })) {
      console.log(`  - admin account ${email}: already exists`);
    } else {
      await User.create({
        name: process.env.ADMIN_NAME || 'CED Admin',
        email,
        password: process.env.ADMIN_PASSWORD || 'ChangeMe@2026',
        role: 'admin',
      });
      console.log(`  + admin account created: ${email}`);
    }
    console.log('\nDone. Start the API with "npm run dev".');
    process.exit(0);
  } catch (err) {
    console.error(explain(err) || err);
    process.exit(1);
  }
})();
