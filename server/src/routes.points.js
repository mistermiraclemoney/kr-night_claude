const express = require('express');
const crypto = require('crypto');
const { q } = require('./db');
const { auth, ah, awardPoints } = require('./util');

const router = express.Router();

// GET /api/points -- balance + ledger
router.get('/', auth, ah(async (req, res) => {
  const { rows } = await q(
    'SELECT * FROM points_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
  res.json({ balance: req.user.points, ledger: rows });
}));

// POST /api/points/redeem { coupon_id } -- exchange points for a coupon
router.post('/redeem', auth, ah(async (req, res) => {
  const { coupon_id } = req.body || {};
  const cres = await q('SELECT * FROM coupons WHERE id=$1 AND is_active=TRUE', [coupon_id]);
  const coupon = cres.rows[0];
  if (!coupon) return res.status(404).json({ error: 'COUPON_NOT_FOUND' });
  if (req.user.points < coupon.points_cost) return res.status(400).json({ error: 'NOT_ENOUGH_POINTS' });

  const code = 'KRN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const ins = await q(
    'INSERT INTO coupon_redemptions (coupon_id, user_id, code) VALUES ($1,$2,$3) RETURNING *',
    [coupon.id, req.user.id, code]
  );
  let balance = req.user.points;
  if (coupon.points_cost > 0)
    balance = await awardPoints(req.user.id, -coupon.points_cost, 'coupon_redeem', 'coupon', coupon.id);
  res.json({ redemption: ins.rows[0], balance });
}));

// GET /api/points/coupons -- my redeemed coupons
router.get('/coupons', auth, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT r.*, c.title, c.description, c.points_cost, v.name AS venue_name, v.cover_emoji
     FROM coupon_redemptions r
     JOIN coupons c ON c.id = r.coupon_id
     JOIN venues v ON v.id = c.venue_id
     WHERE r.user_id=$1 ORDER BY r.redeemed_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ coupons: rows });
}));

// GET /api/points/saved -- my saved venues
router.get('/saved', auth, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT v.* FROM venue_saves s JOIN venues v ON v.id = s.venue_id
     WHERE s.user_id=$1 ORDER BY s.created_at DESC`,
    [req.user.id]
  );
  res.json({ venues: rows });
}));

module.exports = router;
