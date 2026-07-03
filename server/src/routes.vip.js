// 유저 VIP 멤버십 (기획서 6.3 '사용자 VIP' — 월 6,900원 가설)
// 앱에서 /vip-checkout 웹 결제(토스) 또는 테스트 모드 결제로 30일 VIP 활성화
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { q } = require('./db');
const { auth, ah, JWT_SECRET } = require('./util');

const router = express.Router();

const VIP_PRICE = 6900;
const VIP_BENEFITS_KO = ['우선 입장 레인 (제휴 매장)', '한정 이벤트·게스트리스트 우선 응모', '포인트 1.5배 적립', 'VIP 전용 배지 & 프로필 링', '추후: 매칭·고급 필터 우선 오픈'];
const TOSS_SECRET = process.env.TOSS_SECRET_KEY || '';

async function activateVip(userId, days = 30) {
  const { rows } = await q(
    `UPDATE users SET vip_until = GREATEST(COALESCE(vip_until, NOW()), NOW()) + ($1 || ' days')::interval
     WHERE id=$2 RETURNING vip_until`,
    [days, userId]
  );
  return rows[0].vip_until;
}

// GET /api/vip/status
router.get('/status', auth, ah(async (req, res) => {
  const isVip = req.user.vip_until && new Date(req.user.vip_until) > new Date();
  res.json({
    is_vip: !!isVip,
    vip_until: req.user.vip_until,
    price: VIP_PRICE,
    benefits: VIP_BENEFITS_KO,
    test_mode: !TOSS_SECRET,
  });
}));

// POST /api/vip/simulate — 테스트 모드 구매 (토스 키 없을 때)
router.post('/simulate', auth, ah(async (req, res) => {
  if (TOSS_SECRET) return res.status(400).json({ error: 'LIVE_MODE' });
  const vipUntil = await activateVip(req.user.id);
  await q('INSERT INTO vip_payments (user_id, amount, status, order_id) VALUES ($1,$2,$3,$4)',
    [req.user.id, VIP_PRICE, 'simulated', 'KRN-VIP-SIM-' + crypto.randomBytes(4).toString('hex')]);
  res.json({ ok: true, vip_until: vipUntil, simulated: true });
}));

// POST /api/vip/confirm — 토스 결제 승인 (checkout 페이지 successUrl에서 호출)
router.post('/confirm', auth, ah(async (req, res) => {
  const { paymentKey, orderId, amount } = req.body || {};
  if (Number(amount) !== VIP_PRICE) return res.status(400).json({ error: 'AMOUNT_MISMATCH' });
  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(TOSS_SECRET + ':').toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount: VIP_PRICE }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(400).json({ error: 'TOSS_CONFIRM_FAILED', detail: data.message });
  const vipUntil = await activateVip(req.user.id);
  await q('INSERT INTO vip_payments (user_id, amount, status, toss_payment_key, order_id) VALUES ($1,$2,$3,$4,$5)',
    [req.user.id, VIP_PRICE, 'paid', paymentKey, orderId]);
  res.json({ ok: true, vip_until: vipUntil });
}));

// GET /vip-checkout?token=<session JWT> — 앱에서 여는 웹 결제 페이지
function checkoutPage(req, res) {
  const clientKey = process.env.TOSS_CLIENT_KEY || 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KR NIGHT VIP</title>
<script src="https://js.tosspayments.com/v1/payment"></script>
<style>
body{background:#050506;color:#F6F6FA;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;margin:0;padding:24px;display:flex;flex-direction:column;align-items:center;min-height:90vh;justify-content:center}
.card{background:linear-gradient(135deg,#1B1030,#31114A);border:1px solid rgba(139,92,246,.5);border-radius:24px;padding:28px;max-width:360px;width:100%;text-align:center}
h1{font-size:22px;margin:8px 0}.p{color:#9A9AB0;font-size:13px;line-height:1.7}
.price{font-size:32px;font-weight:900;margin:14px 0}.price small{font-size:13px;color:#9A9AB0;font-weight:400}
button{width:100%;border:0;border-radius:14px;padding:15px;font-size:15px;font-weight:800;cursor:pointer;margin-top:10px}
.buy{background:linear-gradient(90deg,#FF3B81,#8B5CF6,#3B9EFF);color:#fff}
.sim{background:#1D1D2B;color:#9A9AB0;border:1px solid #2A2A3C}
.ok{color:#34D399;font-weight:800;font-size:16px;margin-top:14px}
</style></head><body>
<div class="card">
  <div style="font-size:38px">👑</div>
  <h1>KR NIGHT <span style="color:#FBBF24">VIP</span></h1>
  <div class="p">우선 입장 · 포인트 1.5배 · 한정 이벤트 우선 응모<br>VIP 배지 & 프로필 링</div>
  <div class="price">₩${VIP_PRICE.toLocaleString()}<small> / 30일</small></div>
  <button class="buy" id="buy">카드로 결제하기</button>
  ${!TOSS_SECRET ? '<button class="sim" id="sim">🧪 테스트 모드 결제 (무료 체험)</button>' : ''}
  <div id="msg"></div>
</div>
<script>
const params = new URLSearchParams(location.search);
const token = params.get('token') || sessionStorage.getItem('krn_vip_token');
if (params.get('token')) sessionStorage.setItem('krn_vip_token', params.get('token'));
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
const done = (until) => { document.getElementById('msg').innerHTML = '<div class="ok">🎉 VIP 활성화 완료!<br><small>' + new Date(until).toLocaleDateString('ko-KR') + ' 까지</small><br><small style="color:#9A9AB0">앱으로 돌아가 새로고침하세요</small></div>'; };

// 결제 승인 리다이렉트 처리
if (params.get('paymentKey')) {
  fetch('/api/vip/confirm', { method: 'POST', headers: H, body: JSON.stringify({
    paymentKey: params.get('paymentKey'), orderId: params.get('orderId'), amount: params.get('amount'),
  })}).then(r => r.json()).then(d => { if (d.ok) done(d.vip_until); else alert('결제 확인 실패: ' + (d.detail || d.error)); });
}

document.getElementById('buy').onclick = () => {
  const toss = TossPayments('${clientKey}');
  toss.requestPayment('카드', {
    amount: ${VIP_PRICE},
    orderId: 'KRN-VIP-' + Date.now(),
    orderName: 'KR NIGHT VIP 30일',
    successUrl: location.origin + '/vip-checkout',
    failUrl: location.origin + '/vip-checkout?fail=1',
  }).catch(() => {});
};
const sim = document.getElementById('sim');
if (sim) sim.onclick = () => {
  fetch('/api/vip/simulate', { method: 'POST', headers: H })
    .then(r => r.json()).then(d => { if (d.ok) done(d.vip_until); else alert('실패: ' + d.error); });
};
if (params.get('fail')) alert('결제가 취소되었습니다');
</script></body></html>`);
}

module.exports = { router, checkoutPage };
