const jwt = require('jsonwebtoken');
const { q } = require('./db');
const { JWT_SECRET, activeCheckin } = require('./util');
const { areFriends } = require('./routes.social');

const BANNED_WORDS = ['씨발', '병신', '개새끼']; // extend via ops
const clean = (s) => {
  let out = String(s || '').slice(0, 500);
  for (const w of BANNED_WORDS) out = out.split(w).join('*'.repeat(w.length));
  return out;
};

function initSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const payload = jwt.verify(token, JWT_SECRET);
      const { rows } = await q('SELECT id, nickname, handle, avatar_emoji, is_banned FROM users WHERE id=$1', [payload.uid]);
      if (!rows[0] || rows[0].is_banned) return next(new Error('unauthorized'));
      socket.user = rows[0];
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const me = socket.user;
    socket.join(`user:${me.id}`);

    // --- Lounge: join requires a valid check-in at that venue ---
    socket.on('lounge:join', async (venueId, cb) => {
      try {
        const checkin = await activeCheckin(me.id);
        if (!checkin || checkin.venue_id !== Number(venueId))
          return cb && cb({ error: 'CHECKIN_REQUIRED' });
        socket.join(`lounge:${venueId}`);
        cb && cb({ ok: true, expires_at: checkin.expires_at });
        socket.to(`lounge:${venueId}`).emit('lounge:system', {
          text: `${me.avatar_emoji} ${me.nickname} joined`, at: new Date().toISOString(),
        });
      } catch (e) { cb && cb({ error: 'SERVER_ERROR' }); }
    });

    socket.on('lounge:message', async ({ venueId, body }, cb) => {
      try {
        const checkin = await activeCheckin(me.id);
        if (!checkin || checkin.venue_id !== Number(venueId))
          return cb && cb({ error: 'CHECKIN_REQUIRED' });
        const text = clean(body);
        if (!text.trim()) return cb && cb({ error: 'EMPTY' });
        const { rows } = await q(
          'INSERT INTO lounge_messages (venue_id, user_id, body) VALUES ($1,$2,$3) RETURNING id, created_at',
          [venueId, me.id, text]
        );
        const msg = {
          id: rows[0].id, body: text, created_at: rows[0].created_at,
          user_id: me.id, nickname: me.nickname, handle: me.handle, avatar_emoji: me.avatar_emoji,
        };
        io.to(`lounge:${venueId}`).emit('lounge:message', msg);
        cb && cb({ ok: true, message: msg });
      } catch (e) { cb && cb({ error: 'SERVER_ERROR' }); }
    });

    socket.on('lounge:leave', (venueId) => socket.leave(`lounge:${venueId}`));

    // --- DM: friends only ---
    socket.on('dm:send', async ({ toUserId, body }, cb) => {
      try {
        if (!(await areFriends(me.id, Number(toUserId))))
          return cb && cb({ error: 'FRIENDS_ONLY' });
        const text = clean(body);
        if (!text.trim()) return cb && cb({ error: 'EMPTY' });
        const { rows } = await q(
          'INSERT INTO dm_messages (from_user, to_user, body) VALUES ($1,$2,$3) RETURNING id, created_at',
          [me.id, toUserId, text]
        );
        const msg = {
          id: rows[0].id, from_user: me.id, to_user: Number(toUserId), body: text,
          created_at: rows[0].created_at, nickname: me.nickname, avatar_emoji: me.avatar_emoji,
        };
        io.to(`user:${toUserId}`).emit('dm:message', msg);
        cb && cb({ ok: true, message: msg });
      } catch (e) { cb && cb({ error: 'SERVER_ERROR' }); }
    });
  });

  // Purge lounge messages older than 24h (기획서 4.3 메시지 정책)
  setInterval(() => {
    q(`DELETE FROM lounge_messages WHERE created_at < NOW() - INTERVAL '24 hours'`).catch(() => {});
  }, 60 * 60 * 1000).unref();
}

module.exports = { initSocket };
