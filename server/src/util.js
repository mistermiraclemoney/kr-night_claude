const jwt = require('jsonwebtoken');
const { q } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'krnight-dev-secret-change-me';
const QR_SECRET = process.env.QR_SECRET || 'krnight-qr-secret-change-me';

const signSession = (user) =>
  jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

// Rotating QR pass token: short lived, replay-resistant
const signQrToken = (userId) =>
  jwt.sign({ uid: userId, typ: 'qr', n: Math.random().toString(36).slice(2, 8) }, QR_SECRET, { expiresIn: '90s' });

const verifyQrToken = (token) => {
  const payload = jwt.verify(token, QR_SECRET);
  if (payload.typ !== 'qr') throw new Error('invalid token type');
  return payload;
};

// Express middleware: require login
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await q('SELECT * FROM users WHERE id=$1', [payload.uid]);
    if (!rows[0] || rows[0].is_banned) return res.status(401).json({ error: 'AUTH_INVALID' });
    req.user = rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: 'AUTH_INVALID' });
  }
}

function requireOwner(req, res, next) {
  if (req.user.role !== 'owner' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'OWNER_ONLY' });
  next();
}

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const publicUser = (u) => ({
  id: u.id, nickname: u.nickname, handle: u.handle, avatar_emoji: u.avatar_emoji, role: u.role,
});

// Active (non-expired, non-checked-out) checkin for a user
async function activeCheckin(userId) {
  const { rows } = await q(
    `SELECT c.*, v.name AS venue_name, v.area AS venue_area
     FROM checkins c JOIN venues v ON v.id = c.venue_id
     WHERE c.user_id=$1 AND c.expires_at > NOW() AND c.checked_out_at IS NULL
     ORDER BY c.checked_in_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function awardPoints(userId, delta, reason, refType, refId) {
  await q('INSERT INTO points_ledger (user_id, delta, reason, ref_type, ref_id) VALUES ($1,$2,$3,$4,$5)',
    [userId, delta, reason, refType || null, refId || null]);
  const { rows } = await q('UPDATE users SET points = points + $1 WHERE id=$2 RETURNING points', [delta, userId]);
  return rows[0].points;
}

module.exports = {
  JWT_SECRET, QR_SECRET, signSession, signQrToken, verifyQrToken,
  auth, requireOwner, ah, publicUser, activeCheckin, awardPoints,
};
