require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const { migrate } = require('./db');
const { seed } = require('./seed');
const { initSocket } = require('./socket');

const authRoutes = require('./routes.auth');
const venueRoutes = require('./routes.venues');
const qrRoutes = require('./routes.qr');
const { router: socialRoutes } = require('./routes.social');
const pointsRoutes = require('./routes.points');
const ownerRoutes = require('./routes.owner');
const { router: subsRoutes, startBillingLoop } = require('./routes.subs');
const { router: vipRoutes, checkoutPage } = require('./routes.vip');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'KR NIGHT', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/subs', subsRoutes);
app.use('/api/vip', vipRoutes);
app.get('/vip-checkout', checkoutPage);

// Owner web dashboard (static SPA)
app.use('/dashboard', express.static(path.join(__dirname, '..', 'public', 'dashboard')));
app.get('/', (req, res) => res.redirect('/dashboard'));

// error handler
app.use((err, req, res, next) => {
  console.error('[error]', err.message, err.toss || '');
  res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
});

const PORT = process.env.PORT || 8080;

(async () => {
  await migrate();
  if (process.env.SEED_DEMO !== 'false') await seed();
  initSocket(io);
  startBillingLoop();
  server.listen(PORT, () => console.log(`KR NIGHT server listening on :${PORT}`));
})().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
