const express = require('express');
const { q } = require('./db');
const { auth, requireOwner, ah, signQrToken, verifyQrToken, awardPoints, publicUser } = require('./util');

const router = express.Router();

const usedTokens = new Map(); // jti replay guard (in-memory, 90s window)
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of usedTokens) if (exp < now) usedTokens.delete(k);
}, 60_000).unref();

// GET /api/qr/token -- rotating QR pass for the logged-in user
router.get('/token', auth, ah(async (req, res) => {
  res.json({ token: signQrToken(req.user.id), ttl_seconds: 90 });
}));

// POST /api/qr/scan { token } -- staff/owner scans a user's QR pass
// Checks in the user at the scanner's venue.
router.post('/scan', auth, requireOwner, ah(async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'MISSING_TOKEN' });

  // find scanner's venue
  const vres = await q('SELECT * FROM venues WHERE owner_user_id=$1 AND is_active=TRUE LIMIT 1', [req.user.id]);
  const venue = vres.rows[0];
  if (!venue) return res.status(400).json({ error: 'NO_VENUE_FOR_OWNER' });

  let payload;
  try {
    payload = verifyQrToken(token);
  } catch (e) {
    return res.status(400).json({ error: 'QR_EXPIRED_OR_INVALID' });
  }

  // replay guard
  if (usedTokens.has(token)) return res.status(409).json({ error: 'QR_ALREADY_USED' });
  usedTokens.set(token, Date.now() + 120_000);

  const ures = await q('SELECT * FROM users WHERE id=$1 AND is_banned=FALSE', [payload.uid]);
  const guest = ures.rows[0];
  if (!guest) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  // duplicate check-in guard: same venue within 4 hours
  const dupe = await q(
    `SELECT id FROM checkins WHERE user_id=$1 AND venue_id=$2 AND checked_in_at > NOW() - INTERVAL '4 hours'`,
    [guest.id, venue.id]
  );
  if (dupe.rows.length) return res.status(409).json({ error: 'ALREADY_CHECKED_IN', guest: publicUser(guest) });

  // close any other active checkin (user moved venues)
  await q('UPDATE checkins SET checked_out_at = NOW() WHERE user_id=$1 AND checked_out_at IS NULL AND expires_at > NOW()', [guest.id]);

  // points: first visit 100, repeat 30, off-peak (18:00-22:00 KST) +20, daily cap 300
  const first = await q('SELECT 1 FROM checkins WHERE user_id=$1 AND venue_id=$2 LIMIT 1', [guest.id, venue.id]);
  let pts = first.rows.length ? 30 : 100;
  const kstHour = (new Date().getUTCHours() + 9) % 24;
  const offpeak = kstHour >= 18 && kstHour < 22;
  if (offpeak) pts += 20;
  const today = await q(
    `SELECT COALESCE(SUM(delta),0) AS s FROM points_ledger
     WHERE user_id=$1 AND delta > 0 AND created_at::date = CURRENT_DATE AND reason LIKE 'checkin%'`,
    [guest.id]
  );
  pts = Math.max(0, Math.min(pts, 300 - Number(today.rows[0].s)));

  const ins = await q(
    `INSERT INTO checkins (user_id, venue_id, scanned_by, points_awarded, expires_at)
     VALUES ($1,$2,$3,$4, NOW() + INTERVAL '6 hours') RETURNING *`,
    [guest.id, venue.id, req.user.id, pts]
  );

  let balance = guest.points;
  if (pts > 0) {
    balance = await awardPoints(guest.id, pts, first.rows.length ? 'checkin' : 'checkin_first', 'checkin', ins.rows[0].id);
    if (offpeak) await q(`UPDATE points_ledger SET reason = reason || '+offpeak' WHERE ref_type='checkin' AND ref_id=$1`, [ins.rows[0].id]);
  }

  res.json({
    ok: true,
    checkin: ins.rows[0],
    guest: { ...publicUser(guest), points: balance },
    venue: { id: venue.id, name: venue.name },
    points_awarded: pts,
    first_visit: !first.rows.length,
  });
}));

// POST /api/qr/checkout -- user manually checks out (ends lounge + location status)
router.post('/checkout', auth, ah(async (req, res) => {
  await q('UPDATE checkins SET checked_out_at = NOW() WHERE user_id=$1 AND checked_out_at IS NULL AND expires_at > NOW()', [req.user.id]);
  res.json({ ok: true });
}));

// GET /api/qr/history -- my check-in history
router.get('/history', auth, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT c.id, c.checked_in_at, c.points_awarded, v.name AS venue_name, v.area, v.cover_emoji
     FROM checkins c JOIN venues v ON v.id = c.venue_id
     WHERE c.user_id=$1 ORDER BY c.checked_in_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ checkins: rows });
}));

module.exports = router;
