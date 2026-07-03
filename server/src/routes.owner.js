const express = require('express');
const { q } = require('./db');
const { auth, requireOwner, ah } = require('./util');

const router = express.Router();
router.use(auth, requireOwner);

async function myVenue(userId) {
  const { rows } = await q('SELECT * FROM venues WHERE owner_user_id=$1 LIMIT 1', [userId]);
  return rows[0] || null;
}

// POST /api/owner/venue -- create my venue (one per owner in v1)
router.post('/venue', ah(async (req, res) => {
  const existing = await myVenue(req.user.id);
  if (existing) return res.status(409).json({ error: 'VENUE_EXISTS', venue: existing });
  const b = req.body || {};
  if (!b.name || !b.area || !b.category) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const { rows } = await q(
    `INSERT INTO venues (name, name_en, area, category, description_ko, description_en, lat, lng, address,
       instagram, genres, foreigner_friendly, entry_difficulty, price_range, dress_code, open_hours,
       cover_emoji, cover_color, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [b.name, b.name_en || b.name, b.area, b.category, b.description_ko || '', b.description_en || '',
     b.lat || null, b.lng || null, b.address || '', b.instagram || '', b.genres || '',
     b.foreigner_friendly !== false, b.entry_difficulty || 'easy', b.price_range || '₩₩',
     b.dress_code || 'Casual', b.open_hours || '20:00 - 05:00', b.cover_emoji || '🎶',
     b.cover_color || '#7C3AED', req.user.id]
  );
  res.json({ venue: rows[0] });
}));

// GET /api/owner/venue
router.get('/venue', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  res.json({ venue });
}));

// PATCH /api/owner/venue
router.patch('/venue', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });
  const allowed = ['name','name_en','area','category','description_ko','description_en','description_ja','description_zh',
    'lat','lng','address','instagram','genres','foreigner_friendly','entry_difficulty','price_range','dress_code',
    'entry_rules_ko','entry_rules_en','entry_rules_ja','entry_rules_zh','open_hours','cover_emoji','cover_color','is_active'];
  const sets = []; const params = [];
  for (const k of allowed) {
    if (k in (req.body || {})) { params.push(req.body[k]); sets.push(`${k}=$${params.length}`); }
  }
  if (!sets.length) return res.json({ venue });
  params.push(venue.id);
  const { rows } = await q(`UPDATE venues SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING *`, params);
  res.json({ venue: rows[0] });
}));

// --- Events CRUD ---
router.get('/events', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.json({ events: [] });
  const { rows } = await q('SELECT * FROM events WHERE venue_id=$1 ORDER BY event_date DESC LIMIT 50', [venue.id]);
  res.json({ events: rows });
}));

router.post('/events', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });
  const { title, event_date, lineup, price, description } = req.body || {};
  if (!title || !event_date) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const { rows } = await q(
    'INSERT INTO events (venue_id, title, event_date, lineup, price, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [venue.id, title, event_date, lineup || '', price || '', description || '']
  );
  res.json({ event: rows[0] });
}));

router.delete('/events/:id', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  await q('DELETE FROM events WHERE id=$1 AND venue_id=$2', [req.params.id, venue ? venue.id : -1]);
  res.json({ ok: true });
}));

// --- Coupons CRUD ---
router.get('/coupons', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.json({ coupons: [] });
  const { rows } = await q(
    `SELECT c.*, (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id=c.id) AS redeemed_count
     FROM coupons c WHERE venue_id=$1 ORDER BY c.created_at DESC`, [venue.id]);
  res.json({ coupons: rows });
}));

router.post('/coupons', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });
  const { title, description, points_cost } = req.body || {};
  if (!title) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const { rows } = await q(
    'INSERT INTO coupons (venue_id, title, description, points_cost) VALUES ($1,$2,$3,$4) RETURNING *',
    [venue.id, title, description || '', Number(points_cost) || 0]
  );
  res.json({ coupon: rows[0] });
}));

router.patch('/coupons/:id', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  const { rows } = await q(
    'UPDATE coupons SET is_active=$1 WHERE id=$2 AND venue_id=$3 RETURNING *',
    [!!req.body.is_active, req.params.id, venue ? venue.id : -1]
  );
  res.json({ coupon: rows[0] || null });
}));

// POST /api/owner/coupons/use { code } -- staff marks a customer coupon as used
router.post('/coupons/use', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });
  const { code } = req.body || {};
  const { rows } = await q(
    `UPDATE coupon_redemptions r SET used_at = NOW()
     FROM coupons c
     WHERE r.coupon_id = c.id AND c.venue_id=$1 AND r.code=$2 AND r.used_at IS NULL
     RETURNING r.*, c.title`,
    [venue.id, String(code || '').toUpperCase().trim()]
  );
  if (!rows[0]) return res.status(404).json({ error: 'CODE_INVALID_OR_USED' });
  res.json({ ok: true, redemption: rows[0] });
}));

// GET /api/owner/stats -- the report a venue pays for (기획서 6.3/10.2)
router.get('/stats', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });
  const vid = venue.id;

  const [today, week, month, uniq, repeat, byDay, byHour, couponUse, liveNow] = await Promise.all([
    q(`SELECT COUNT(*) n FROM checkins WHERE venue_id=$1 AND checked_in_at::date = CURRENT_DATE`, [vid]),
    q(`SELECT COUNT(*) n FROM checkins WHERE venue_id=$1 AND checked_in_at > NOW() - INTERVAL '7 days'`, [vid]),
    q(`SELECT COUNT(*) n FROM checkins WHERE venue_id=$1 AND checked_in_at > NOW() - INTERVAL '30 days'`, [vid]),
    q(`SELECT COUNT(DISTINCT user_id) n FROM checkins WHERE venue_id=$1 AND checked_in_at > NOW() - INTERVAL '30 days'`, [vid]),
    q(`SELECT COUNT(*) n FROM (
         SELECT user_id FROM checkins WHERE venue_id=$1 AND checked_in_at > NOW() - INTERVAL '30 days'
         GROUP BY user_id HAVING COUNT(*) > 1) t`, [vid]),
    q(`SELECT checked_in_at::date d, COUNT(*) n FROM checkins
       WHERE venue_id=$1 AND checked_in_at > NOW() - INTERVAL '14 days' GROUP BY d ORDER BY d`, [vid]),
    q(`SELECT EXTRACT(HOUR FROM checked_in_at AT TIME ZONE 'Asia/Seoul') h, COUNT(*) n FROM checkins
       WHERE venue_id=$1 AND checked_in_at > NOW() - INTERVAL '30 days' GROUP BY h ORDER BY h`, [vid]),
    q(`SELECT COUNT(*) redeemed, COUNT(used_at) used FROM coupon_redemptions r
       JOIN coupons c ON c.id=r.coupon_id WHERE c.venue_id=$1`, [vid]),
    q(`SELECT COUNT(*) n FROM checkins WHERE venue_id=$1 AND expires_at > NOW() AND checked_out_at IS NULL`, [vid]),
  ]);

  res.json({
    venue,
    stats: {
      checkins_today: Number(today.rows[0].n),
      checkins_7d: Number(week.rows[0].n),
      checkins_30d: Number(month.rows[0].n),
      unique_guests_30d: Number(uniq.rows[0].n),
      repeat_guests_30d: Number(repeat.rows[0].n),
      live_now: Number(liveNow.rows[0].n),
      by_day: byDay.rows,
      by_hour: byHour.rows,
      coupons: couponUse.rows[0],
    },
  });
}));

// GET /api/owner/checkins/today -- live guest list for the door
router.get('/checkins/today', ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.json({ checkins: [] });
  const { rows } = await q(
    `SELECT c.id, c.checked_in_at, c.points_awarded, c.expires_at, c.checked_out_at,
            u.nickname, u.handle, u.avatar_emoji
     FROM checkins c JOIN users u ON u.id = c.user_id
     WHERE c.venue_id=$1 AND c.checked_in_at::date = CURRENT_DATE
     ORDER BY c.checked_in_at DESC`,
    [venue.id]
  );
  res.json({ checkins: rows });
}));

module.exports = router;
