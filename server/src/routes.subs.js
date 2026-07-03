const express = require('express');
const crypto = require('crypto');
const { q } = require('./db');
const { auth, requireOwner, ah } = require('./util');

const router = express.Router();

// 기획서 6.4 가격 가설
const PLANS = {
  growth: { name: 'Growth', price: 99000, features: ['쿠폰 발행', '기본 통계', '다국어 정보 관리', '이벤트 등록'] },
  pro: { name: 'Pro', price: 249000, features: ['추천 노출 (리스트 상단)', 'CRM·재방문 리포트', '라운지 관리', '고급 통계', 'Growth 전체 포함'] },
};

const TOSS_SECRET = process.env.TOSS_SECRET_KEY || ''; // e.g. test_sk_...
const tossAuthHeader = () => 'Basic ' + Buffer.from(TOSS_SECRET + ':').toString('base64');

async function tossApi(path, body) {
  const r = await fetch('https://api.tosspayments.com' + path, {
    method: 'POST',
    headers: { Authorization: tossAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.message || 'TOSS_ERROR'), { toss: data });
  return data;
}

async function myVenue(userId) {
  const { rows } = await q('SELECT * FROM venues WHERE owner_user_id=$1 LIMIT 1', [userId]);
  return rows[0] || null;
}

// GET /api/subs/plans
router.get('/plans', (req, res) => {
  res.json({
    plans: PLANS,
    toss_client_key: process.env.TOSS_CLIENT_KEY || 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm', // Toss public docs test key
    test_mode: !TOSS_SECRET,
  });
});

// GET /api/subs/current
router.get('/current', auth, requireOwner, ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.json({ subscription: null, venue: null });
  const { rows } = await q(
    `SELECT * FROM subscriptions WHERE venue_id=$1 AND status IN ('active','past_due') ORDER BY started_at DESC LIMIT 1`,
    [venue.id]);
  const payments = rows[0]
    ? (await q('SELECT * FROM payments WHERE subscription_id=$1 ORDER BY paid_at DESC LIMIT 12', [rows[0].id])).rows
    : [];
  res.json({ subscription: rows[0] || null, payments, venue: { id: venue.id, name: venue.name, plan: venue.plan } });
}));

async function activateSubscription(venue, plan, billingKey, cardSummary, customerKey, simulated) {
  const price = PLANS[plan].price;
  // cancel previous
  await q(`UPDATE subscriptions SET status='canceled', canceled_at=NOW() WHERE venue_id=$1 AND status='active'`, [venue.id]);
  const sub = (await q(
    `INSERT INTO subscriptions (venue_id, plan, price, customer_key, billing_key, card_summary, next_billing_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW() + INTERVAL '1 month') RETURNING *`,
    [venue.id, plan, price, customerKey, billingKey, cardSummary]
  )).rows[0];

  const orderId = 'KRN-SUB-' + crypto.randomBytes(6).toString('hex');
  let paymentStatus = 'simulated', paymentKey = null;

  if (!simulated && TOSS_SECRET && billingKey) {
    const pay = await tossApi(`/v1/billing/${encodeURIComponent(billingKey)}`, {
      customerKey, amount: price, orderId, orderName: `KR NIGHT ${PLANS[plan].name} 월 구독`,
    });
    paymentStatus = 'paid';
    paymentKey = pay.paymentKey;
  }

  await q('INSERT INTO payments (subscription_id, amount, status, toss_payment_key, order_id) VALUES ($1,$2,$3,$4,$5)',
    [sub.id, price, paymentStatus, paymentKey, orderId]);
  await q(`UPDATE venues SET plan=$1, subscription_status='active' WHERE id=$2`, [plan, venue.id]);
  return sub;
}

// POST /api/subs/confirm-billing { authKey, customerKey, plan }
// Called after Toss requestBillingAuth() success redirect.
router.post('/confirm-billing', auth, requireOwner, ah(async (req, res) => {
  const { authKey, customerKey, plan } = req.body || {};
  if (!PLANS[plan]) return res.status(400).json({ error: 'INVALID_PLAN' });
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });

  if (!TOSS_SECRET) {
    // test mode: simulate billing key issuance
    const sub = await activateSubscription(venue, plan, 'SIMULATED-' + Date.now(), '테스트 카드 (모의)', customerKey || 'sim', true);
    return res.json({ subscription: sub, simulated: true });
  }

  const issued = await tossApi('/v1/billing/authorizations/issue', { authKey, customerKey });
  const cardSummary = issued.card ? `${issued.card.issuerCode || ''} ${issued.card.number || ''}`.trim() : issued.cardCompany || '카드';
  const sub = await activateSubscription(venue, plan, issued.billingKey, cardSummary, customerKey, false);
  res.json({ subscription: sub, simulated: false });
}));

// POST /api/subs/simulate { plan } -- explicit test-mode subscribe (no card)
router.post('/simulate', auth, requireOwner, ah(async (req, res) => {
  const { plan } = req.body || {};
  if (!PLANS[plan]) return res.status(400).json({ error: 'INVALID_PLAN' });
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });
  const sub = await activateSubscription(venue, plan, null, '테스트 모드 (결제 없음)', 'sim-' + req.user.id, true);
  res.json({ subscription: sub, simulated: true });
}));

// POST /api/subs/cancel
router.post('/cancel', auth, requireOwner, ah(async (req, res) => {
  const venue = await myVenue(req.user.id);
  if (!venue) return res.status(404).json({ error: 'NO_VENUE' });
  await q(`UPDATE subscriptions SET status='canceled', canceled_at=NOW() WHERE venue_id=$1 AND status='active'`, [venue.id]);
  await q(`UPDATE venues SET plan='free', subscription_status='canceled' WHERE id=$1`, [venue.id]);
  res.json({ ok: true });
}));

// Monthly renewal loop (runs hourly; charges subscriptions past next_billing_at)
function startBillingLoop() {
  setInterval(async () => {
    try {
      const { rows } = await q(`SELECT * FROM subscriptions WHERE status='active' AND next_billing_at < NOW()`);
      for (const sub of rows) {
        const orderId = 'KRN-REN-' + crypto.randomBytes(6).toString('hex');
        try {
          let status = 'simulated', key = null;
          if (TOSS_SECRET && sub.billing_key && !String(sub.billing_key).startsWith('SIMULATED')) {
            const pay = await tossApi(`/v1/billing/${encodeURIComponent(sub.billing_key)}`, {
              customerKey: sub.customer_key, amount: sub.price, orderId,
              orderName: `KR NIGHT ${sub.plan} 월 구독 갱신`,
            });
            status = 'paid'; key = pay.paymentKey;
          }
          await q('INSERT INTO payments (subscription_id, amount, status, toss_payment_key, order_id) VALUES ($1,$2,$3,$4,$5)',
            [sub.id, sub.price, status, key, orderId]);
          await q(`UPDATE subscriptions SET next_billing_at = next_billing_at + INTERVAL '1 month' WHERE id=$1`, [sub.id]);
        } catch (e) {
          console.error('[billing] renewal failed for sub', sub.id, e.message);
          await q(`UPDATE subscriptions SET status='past_due' WHERE id=$1`, [sub.id]);
          await q(`UPDATE venues SET subscription_status='past_due' WHERE id=$1`, [sub.venue_id]);
        }
      }
    } catch (e) {
      console.error('[billing] loop error', e.message);
    }
  }, 60 * 60 * 1000).unref();
}

module.exports = { router, startBillingLoop, PLANS };
