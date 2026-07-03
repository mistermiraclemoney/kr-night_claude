const express = require('express');
const bcrypt = require('bcryptjs');
const { q } = require('./db');
const { signSession, auth, ah, activeCheckin } = require('./util');

const router = express.Router();

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

function sanitizeMe(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

// POST /api/auth/register { email, password, nickname, handle, language?, asOwner? }
router.post('/register', ah(async (req, res) => {
  const { email, password, nickname, handle, language, asOwner } = req.body || {};
  if (!email || !password || !nickname || !handle)
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (password.length < 6) return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
  const h = String(handle).toLowerCase();
  if (!HANDLE_RE.test(h)) return res.status(400).json({ error: 'INVALID_HANDLE' });

  const dupe = await q('SELECT id FROM users WHERE email=$1 OR handle=$2', [email.toLowerCase(), h]);
  if (dupe.rows.length) return res.status(409).json({ error: 'ALREADY_EXISTS' });

  const hash = await bcrypt.hash(password, 10);
  const role = asOwner ? 'owner' : 'user';
  const lang = ['ko', 'en', 'ja', 'zh'].includes(language) ? language : 'ko';
  const { rows } = await q(
    `INSERT INTO users (email, password_hash, nickname, handle, role, language)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [email.toLowerCase(), hash, nickname, h, role, lang]
  );
  const user = rows[0];
  res.json({ token: signSession(user), user: sanitizeMe(user) });
}));

// POST /api/auth/login { email, password }
router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await q('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash)))
    return res.status(401).json({ error: 'BAD_CREDENTIALS' });
  if (user.is_banned) return res.status(403).json({ error: 'BANNED' });
  res.json({ token: signSession(user), user: sanitizeMe(user) });
}));

// GET /api/auth/me
router.get('/me', auth, ah(async (req, res) => {
  const checkin = await activeCheckin(req.user.id);
  res.json({ user: sanitizeMe(req.user), active_checkin: checkin });
}));

// PATCH /api/auth/me { nickname?, language?, avatar_emoji?, location_sharing? }
router.patch('/me', auth, ah(async (req, res) => {
  const { nickname, language, avatar_emoji, location_sharing } = req.body || {};
  const u = req.user;
  const lang = ['ko', 'en', 'ja', 'zh'].includes(language) ? language : u.language;
  const { rows } = await q(
    `UPDATE users SET nickname=COALESCE($1,nickname), language=$2,
       avatar_emoji=COALESCE($3,avatar_emoji),
       location_sharing=COALESCE($4,location_sharing)
     WHERE id=$5 RETURNING *`,
    [nickname || null, lang, avatar_emoji || null,
     typeof location_sharing === 'boolean' ? location_sharing : null, u.id]
  );
  res.json({ user: sanitizeMe(rows[0]) });
}));

module.exports = router;
