const express = require('express');
const { q } = require('./db');
const { auth, ah, publicUser, activeCheckin } = require('./util');

const router = express.Router();

// GET /api/social/friends -- accepted friends with status (venue if sharing)
router.get('/friends', auth, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT u.id, u.nickname, u.handle, u.avatar_emoji, u.location_sharing
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id=$1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id=$1 OR f.addressee_id=$1) AND f.status='accepted'`,
    [req.user.id]
  );
  const friends = [];
  for (const f of rows) {
    let status = null;
    if (f.location_sharing) {
      const c = await activeCheckin(f.id);
      if (c) status = { venue_id: c.venue_id, venue_name: c.venue_name, area: c.venue_area, since: c.checked_in_at };
    }
    friends.push({ id: f.id, nickname: f.nickname, handle: f.handle, avatar_emoji: f.avatar_emoji, status });
  }
  res.json({ friends });
}));

// GET /api/social/requests -- incoming pending requests
router.get('/requests', auth, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT f.id AS request_id, u.id, u.nickname, u.handle, u.avatar_emoji
     FROM friendships f JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id=$1 AND f.status='pending'`,
    [req.user.id]
  );
  res.json({ requests: rows });
}));

// GET /api/social/search?handle=
router.get('/search', auth, ah(async (req, res) => {
  const h = String(req.query.handle || '').toLowerCase().replace('@', '');
  if (h.length < 2) return res.json({ users: [] });
  const { rows } = await q(
    `SELECT id, nickname, handle, avatar_emoji FROM users
     WHERE (handle ILIKE $1 OR nickname ILIKE $1) AND id != $2 AND is_banned=FALSE LIMIT 10`,
    [`%${h}%`, req.user.id]
  );
  res.json({ users: rows });
}));

// POST /api/social/request { user_id }
router.post('/request', auth, ah(async (req, res) => {
  const target = Number(req.body.user_id);
  if (!target || target === req.user.id) return res.status(400).json({ error: 'INVALID_TARGET' });
  const existing = await q(
    `SELECT * FROM friendships WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)`,
    [req.user.id, target]
  );
  if (existing.rows.length) {
    const f = existing.rows[0];
    if (f.status === 'blocked') return res.status(403).json({ error: 'BLOCKED' });
    // if they already requested me, auto-accept (mutual consent)
    if (f.status === 'pending' && f.requester_id === target) {
      await q(`UPDATE friendships SET status='accepted' WHERE id=$1`, [f.id]);
      return res.json({ status: 'accepted' });
    }
    return res.json({ status: f.status });
  }
  await q('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1,$2)', [req.user.id, target]);
  res.json({ status: 'pending' });
}));

// POST /api/social/respond { request_id, accept }
router.post('/respond', auth, ah(async (req, res) => {
  const { request_id, accept } = req.body || {};
  const { rows } = await q('SELECT * FROM friendships WHERE id=$1 AND addressee_id=$2 AND status=$3',
    [request_id, req.user.id, 'pending']);
  if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
  if (accept) await q(`UPDATE friendships SET status='accepted' WHERE id=$1`, [request_id]);
  else await q('DELETE FROM friendships WHERE id=$1', [request_id]);
  res.json({ ok: true });
}));

// POST /api/social/block { user_id }
router.post('/block', auth, ah(async (req, res) => {
  const target = Number(req.body.user_id);
  await q(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1,$2,'blocked')
     ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status='blocked'`,
    [req.user.id, target]
  );
  await q(`DELETE FROM friendships WHERE requester_id=$1 AND addressee_id=$2 AND status != 'blocked'`, [target, req.user.id]);
  res.json({ ok: true });
}));

async function areFriends(a, b) {
  const { rows } = await q(
    `SELECT 1 FROM friendships WHERE status='accepted' AND
     ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1))`,
    [a, b]
  );
  return rows.length > 0;
}

// GET /api/social/dm/:userId -- conversation history (friends only)
router.get('/dm/:userId', auth, ah(async (req, res) => {
  const other = Number(req.params.userId);
  if (!(await areFriends(req.user.id, other))) return res.status(403).json({ error: 'FRIENDS_ONLY' });
  const { rows } = await q(
    `SELECT * FROM dm_messages
     WHERE (from_user=$1 AND to_user=$2) OR (from_user=$2 AND to_user=$1)
     ORDER BY created_at ASC LIMIT 200`,
    [req.user.id, other]
  );
  res.json({ messages: rows });
}));

// GET /api/social/conversations -- recent DM threads
router.get('/conversations', auth, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT DISTINCT ON (pair) m.*, u.nickname, u.handle, u.avatar_emoji
     FROM (
       SELECT *, CASE WHEN from_user=$1 THEN to_user ELSE from_user END AS pair
       FROM dm_messages WHERE from_user=$1 OR to_user=$1
     ) m
     JOIN users u ON u.id = m.pair
     ORDER BY pair, m.created_at DESC`,
    [req.user.id]
  );
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ conversations: rows });
}));

module.exports = { router, areFriends };
