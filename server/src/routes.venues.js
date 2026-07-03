const express = require('express');
const { q } = require('./db');
const { auth, ah, activeCheckin } = require('./util');

const router = express.Router();

// GET /api/venues?area=&category=&genre=&foreigner=1&search=
router.get('/', auth, ah(async (req, res) => {
  const { area, category, genre, foreigner, search } = req.query;
  const cond = ['v.is_active = TRUE'];
  const params = [];
  if (area) { params.push(area); cond.push(`v.area = $${params.length}`); }
  if (category) { params.push(category); cond.push(`v.category = $${params.length}`); }
  if (genre) { params.push(`%${genre}%`); cond.push(`v.genres ILIKE $${params.length}`); }
  if (foreigner === '1') cond.push('v.foreigner_friendly = TRUE');
  if (search) { params.push(`%${search}%`); cond.push(`(v.name ILIKE $${params.length} OR v.name_en ILIKE $${params.length})`); }

  const { rows } = await q(
    `SELECT v.*,
       (SELECT COUNT(*) FROM checkins c WHERE c.venue_id = v.id AND c.expires_at > NOW() AND c.checked_out_at IS NULL) AS live_count,
       (SELECT COUNT(*) FROM venue_saves s WHERE s.venue_id = v.id) AS save_count,
       EXISTS(SELECT 1 FROM venue_saves s WHERE s.venue_id = v.id AND s.user_id = $${params.length + 1}) AS saved
     FROM venues v WHERE ${cond.join(' AND ')}
     ORDER BY (v.plan = 'pro') DESC, live_count DESC, v.id`,
    [...params, req.user.id]
  );
  res.json({ venues: rows });
}));

// GET /api/venues/routes?area=  -- tonight's recommended routes
router.get('/routes', auth, ah(async (req, res) => {
  const { area } = req.query;
  const params = [];
  let where = 'is_active = TRUE';
  if (area) { params.push(area); where += ` AND area = $1`; }
  const { rows } = await q(`SELECT * FROM night_routes WHERE ${where} ORDER BY id`, params);
  const routes = [];
  for (const r of rows) {
    const stops = JSON.parse(r.stops);
    const ids = stops.map((s) => s.venue_id);
    const vres = ids.length
      ? await q(`SELECT id, name, name_en, category, area, cover_emoji, cover_color FROM venues WHERE id = ANY($1)`, [ids])
      : { rows: [] };
    const vmap = Object.fromEntries(vres.rows.map((v) => [v.id, v]));
    routes.push({ ...r, stops: stops.map((s) => ({ ...s, venue: vmap[s.venue_id] || null })) });
  }
  res.json({ routes });
}));

// GET /api/venues/:id
router.get('/:id', auth, ah(async (req, res) => {
  const { rows } = await q('SELECT * FROM venues WHERE id=$1', [req.params.id]);
  const venue = rows[0];
  if (!venue) return res.status(404).json({ error: 'NOT_FOUND' });

  const [events, coupons, live, saved, myCheckin] = await Promise.all([
    q(`SELECT * FROM events WHERE venue_id=$1 AND event_date >= CURRENT_DATE ORDER BY event_date LIMIT 10`, [venue.id]),
    q(`SELECT * FROM coupons WHERE venue_id=$1 AND is_active=TRUE ORDER BY points_cost`, [venue.id]),
    q(`SELECT COUNT(*) AS n FROM checkins WHERE venue_id=$1 AND expires_at > NOW() AND checked_out_at IS NULL`, [venue.id]),
    q(`SELECT 1 FROM venue_saves WHERE venue_id=$1 AND user_id=$2`, [venue.id, req.user.id]),
    activeCheckin(req.user.id),
  ]);

  res.json({
    venue,
    events: events.rows,
    coupons: coupons.rows,
    live_count: Number(live.rows[0].n),
    saved: saved.rows.length > 0,
    checked_in_here: !!(myCheckin && myCheckin.venue_id === venue.id),
  });
}));

// POST /api/venues/:id/save  (toggle)
router.post('/:id/save', auth, ah(async (req, res) => {
  const del = await q('DELETE FROM venue_saves WHERE user_id=$1 AND venue_id=$2', [req.user.id, req.params.id]);
  if (del.rowCount === 0)
    await q('INSERT INTO venue_saves (user_id, venue_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
  res.json({ saved: del.rowCount === 0 });
}));

// GET /api/venues/:id/lounge -- lounge messages (must be checked in)
router.get('/:id/lounge', auth, ah(async (req, res) => {
  const checkin = await activeCheckin(req.user.id);
  if (!checkin || checkin.venue_id !== Number(req.params.id))
    return res.status(403).json({ error: 'CHECKIN_REQUIRED' });
  const { rows } = await q(
    `SELECT m.id, m.body, m.created_at, u.id AS user_id, u.nickname, u.handle, u.avatar_emoji
     FROM lounge_messages m JOIN users u ON u.id = m.user_id
     WHERE m.venue_id=$1 AND m.created_at > NOW() - INTERVAL '24 hours'
     ORDER BY m.created_at ASC LIMIT 200`,
    [req.params.id]
  );
  const members = await q(
    `SELECT DISTINCT u.id, u.nickname, u.handle, u.avatar_emoji
     FROM checkins c JOIN users u ON u.id = c.user_id
     WHERE c.venue_id=$1 AND c.expires_at > NOW() AND c.checked_out_at IS NULL`,
    [req.params.id]
  );
  res.json({ messages: rows, members: members.rows, expires_at: checkin.expires_at });
}));

// POST /api/report { target_type, target_id, reason }
router.post('/report', auth, ah(async (req, res) => {
  const { target_type, target_id, reason } = req.body || {};
  if (!target_type || !target_id || !reason) return res.status(400).json({ error: 'MISSING_FIELDS' });
  await q('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4)',
    [req.user.id, target_type, target_id, reason]);
  res.json({ ok: true });
}));

module.exports = router;
