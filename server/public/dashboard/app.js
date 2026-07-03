// KR NIGHT 사장님 대시보드
const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('krn_owner_token') || null;
let venue = null;
let plansInfo = null;

const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.status), { code: data.error, data });
  return data;
};

const toast = (msg) => {
  const el = $('toast');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 3000);
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- auth ----------
async function login() {
  try {
    const d = await api('/api/auth/login', { method: 'POST', body: { email: $('login-email').value, password: $('login-pw').value } });
    if (d.user.role !== 'owner' && d.user.role !== 'admin') return toast('사장님 계정이 아닙니다');
    token = d.token; localStorage.setItem('krn_owner_token', token);
    boot();
  } catch (e) { toast('로그인 실패: 이메일/비밀번호를 확인하세요'); }
}

async function register() {
  try {
    const d = await api('/api/auth/register', { method: 'POST', body: {
      email: $('login-email').value, password: $('login-pw').value,
      nickname: $('reg-nickname').value, handle: $('reg-handle').value, asOwner: true, language: 'ko',
    }});
    token = d.token; localStorage.setItem('krn_owner_token', token);
    boot();
  } catch (e) {
    toast({ ALREADY_EXISTS: '이미 사용 중인 이메일/ID입니다', INVALID_HANDLE: 'ID는 영문 소문자·숫자·_ 3~20자', PASSWORD_TOO_SHORT: '비밀번호 6자 이상', MISSING_FIELDS: '모든 항목을 입력하세요' }[e.code] || '가입 실패');
  }
}

function logout() {
  token = null; localStorage.removeItem('krn_owner_token'); location.reload();
}

// ---------- tabs ----------
function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  ['overview', 'venue', 'events', 'coupons', 'subscribe'].forEach((n) => $('tab-' + n).classList.toggle('hidden', n !== name));
  if (name === 'overview') loadStats();
  if (name === 'venue') renderVenueForm();
  if (name === 'events') loadEvents();
  if (name === 'coupons') loadCoupons();
  if (name === 'subscribe') loadSubscription();
}

// ---------- overview ----------
async function loadStats() {
  try {
    const { venue: v, stats: s } = await api('/api/owner/stats');
    venue = v;
    $('venue-title').textContent = `${v.cover_emoji} ${v.name} · ${v.area} · ${v.plan.toUpperCase()} 플랜`;
    $('stats-grid').innerHTML = [
      ['현재 매장 내', s.live_now, 'var(--green)'],
      ['오늘 체크인', s.checkins_today, 'var(--pink)'],
      ['7일 체크인', s.checkins_7d, 'var(--blue)'],
      ['30일 체크인', s.checkins_30d, 'var(--purple)'],
      ['30일 고유 방문객', s.unique_guests_30d, 'var(--yellow)'],
      ['30일 재방문 고객', s.repeat_guests_30d, 'var(--green)'],
      ['쿠폰 교환', s.coupons.redeemed, 'var(--pink)'],
      ['쿠폰 사용', s.coupons.used, 'var(--blue)'],
    ].map(([l, n, c]) => `<div class="stat"><div class="n" style="color:${c}">${n}</div><div class="l">${l}</div></div>`).join('');

    const days = s.by_day; const maxD = Math.max(1, ...days.map((d) => +d.n));
    $('chart-days').innerHTML = days.length
      ? days.map((d) => `<div class="bar" style="height:${(+d.n / maxD) * 100}%" title="${d.d?.slice?.(0,10) || d.d}: ${d.n}건"><span>${String(d.d).slice(5, 10)}</span></div>`).join('')
      : '<div class="sub">아직 데이터가 없습니다 — 첫 QR 체크인을 만들어보세요.</div>';

    const hours = s.by_hour; const maxH = Math.max(1, ...hours.map((h) => +h.n));
    $('chart-hours').innerHTML = hours.length
      ? hours.map((h) => `<div class="bar" style="height:${(+h.n / maxH) * 100}%;background:linear-gradient(180deg,var(--blue),var(--purple))" title="${h.h}시: ${h.n}건"><span>${h.h}시</span></div>`).join('')
      : '<div class="sub">아직 데이터가 없습니다.</div>';

    const { checkins } = await api('/api/owner/checkins/today');
    $('guest-list').innerHTML = checkins.length
      ? checkins.map((g) => `<div class="row"><div>${esc(g.avatar_emoji)} <b>${esc(g.nickname)}</b> <span class="sub">@${esc(g.handle)}</span></div><div class="sub">${new Date(g.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · +${g.points_awarded}P</div></div>`).join('')
      : '<div class="sub">오늘 체크인한 게스트가 없습니다.</div>';
  } catch (e) {
    if (e.code === 'NO_VENUE') {
      $('venue-title').textContent = '등록된 매장이 없습니다 — 매장 정보 탭에서 등록하세요';
      showTab('venue');
    }
  }
}

// ---------- venue form ----------
async function renderVenueForm() {
  const { venue: v } = await api('/api/owner/venue');
  venue = v;
  const f = (k, def = '') => esc(v ? v[k] ?? def : def);
  $('venue-form').innerHTML = `
    <h2>${v ? '매장 정보 수정' : '매장 등록'}</h2>
    <div class="two">
      <div><label>매장명 (한국어)</label><input id="vf-name" value="${f('name')}"></div>
      <div><label>매장명 (영문)</label><input id="vf-name_en" value="${f('name_en')}"></div>
    </div>
    <div class="two">
      <div><label>지역</label><select id="vf-area">
        ${['itaewon','hongdae','apgujeong','gangnam','seongsu','euljiro'].map((a) => `<option ${v && v.area === a ? 'selected' : ''}>${a}</option>`).join('')}
      </select></div>
      <div><label>종류</label><select id="vf-category">
        ${['club','bar','lounge','pocha'].map((c) => `<option ${v && v.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
    </div>
    <div class="two">
      <div><label>주소</label><input id="vf-address" value="${f('address')}"></div>
      <div><label>인스타그램 (@ 제외)</label><input id="vf-instagram" value="${f('instagram')}"></div>
    </div>
    <div class="two">
      <div><label>위도 (lat)</label><input id="vf-lat" type="number" step="any" value="${f('lat')}"></div>
      <div><label>경도 (lng)</label><input id="vf-lng" type="number" step="any" value="${f('lng')}"></div>
    </div>
    <div class="two">
      <div><label>영업시간</label><input id="vf-open_hours" value="${f('open_hours', '20:00 - 05:00')}"></div>
      <div><label>장르 (쉼표 구분: hiphop,house,kpop...)</label><input id="vf-genres" value="${f('genres')}"></div>
    </div>
    <div class="two">
      <div><label>가격대</label><select id="vf-price_range">${['₩','₩₩','₩₩₩','₩₩₩₩'].map((p) => `<option ${v && v.price_range === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div><label>입장 난이도</label><select id="vf-entry_difficulty">${['easy','normal','strict'].map((d) => `<option ${v && v.entry_difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
    </div>
    <div class="two">
      <div><label>드레스코드</label><input id="vf-dress_code" value="${f('dress_code', 'Casual')}"></div>
      <div><label>대표 이모지 / 색상</label><div style="display:flex;gap:6px">
        <input id="vf-cover_emoji" value="${f('cover_emoji', '🎶')}" style="width:70px">
        <input id="vf-cover_color" type="color" value="${f('cover_color', '#7C3AED')}" style="height:44px">
      </div></div>
    </div>
    <label><input type="checkbox" id="vf-foreigner" ${!v || v.foreigner_friendly ? 'checked' : ''} style="width:auto"> 외국인 방문 환영 (Foreigner friendly)</label>
    <label>소개 (한국어)</label><textarea id="vf-description_ko" rows="2">${f('description_ko')}</textarea>
    <label>Description (English)</label><textarea id="vf-description_en" rows="2">${f('description_en')}</textarea>
    <label>입장 안내 (한국어) — 연령·신분증·입장료·드레스코드</label><textarea id="vf-entry_rules_ko" rows="2">${f('entry_rules_ko')}</textarea>
    <label>Entry rules (English)</label><textarea id="vf-entry_rules_en" rows="2">${f('entry_rules_en')}</textarea>
    <button onclick="saveVenue(${v ? 'false' : 'true'})">${v ? '저장' : '매장 등록'}</button>
  `;
}

async function saveVenue(isNew) {
  const body = {};
  ['name','name_en','area','category','address','instagram','open_hours','genres','price_range','entry_difficulty','dress_code','cover_emoji','cover_color','description_ko','description_en','entry_rules_ko','entry_rules_en']
    .forEach((k) => { body[k] = $('vf-' + k).value; });
  body.lat = parseFloat($('vf-lat').value) || null;
  body.lng = parseFloat($('vf-lng').value) || null;
  body.foreigner_friendly = $('vf-foreigner').checked;
  try {
    await api('/api/owner/venue', { method: isNew ? 'POST' : 'PATCH', body });
    toast('저장되었습니다 ✅');
    loadStats();
  } catch (e) { toast('저장 실패: ' + (e.code || e.message)); }
}

// ---------- events ----------
async function loadEvents() {
  const { events } = await api('/api/owner/events');
  $('event-list').innerHTML = events.length
    ? events.map((e) => `<div class="row"><div><b>${esc(e.title)}</b> <span class="sub">${String(e.event_date).slice(0, 10)}</span><br><span class="sub">🎧 ${esc(e.lineup || '-')} · 💰 ${esc(e.price || '-')}</span></div><button class="ghost" onclick="delEvent(${e.id})">삭제</button></div>`).join('')
    : '<div class="sub">등록된 이벤트가 없습니다.</div>';
}
async function createEvent() {
  try {
    await api('/api/owner/events', { method: 'POST', body: { title: $('ev-title').value, event_date: $('ev-date').value, lineup: $('ev-lineup').value, price: $('ev-price').value } });
    $('ev-title').value = ''; $('ev-lineup').value = ''; $('ev-price').value = '';
    toast('이벤트 등록 ✅'); loadEvents();
  } catch (e) { toast('제목과 날짜를 입력하세요'); }
}
async function delEvent(id) { await api('/api/owner/events/' + id, { method: 'DELETE' }); loadEvents(); }

// ---------- coupons ----------
async function loadCoupons() {
  const { coupons } = await api('/api/owner/coupons');
  $('coupon-list').innerHTML = coupons.length
    ? coupons.map((c) => `<div class="row"><div><b>${esc(c.title)}</b> <span class="badge" style="color:var(--${c.points_cost > 0 ? 'pink' : 'green'});border-color:var(--${c.points_cost > 0 ? 'pink' : 'green'})">${c.points_cost > 0 ? c.points_cost + 'P' : '무료 혜택'}</span><br><span class="sub">${esc(c.description || '')} · 교환 ${c.redeemed_count}건</span></div><button class="ghost" onclick="toggleCoupon(${c.id}, ${!c.is_active})">${c.is_active ? '비활성화' : '활성화'}</button></div>`).join('')
    : '<div class="sub">쿠폰이 없습니다. 웰컴 혜택부터 만들어보세요.</div>';
}
async function createCoupon() {
  try {
    await api('/api/owner/coupons', { method: 'POST', body: { title: $('cp-title').value, description: $('cp-desc').value, points_cost: $('cp-cost').value } });
    $('cp-title').value = ''; $('cp-desc').value = ''; $('cp-cost').value = '';
    toast('쿠폰 생성 ✅'); loadCoupons();
  } catch (e) { toast('쿠폰명을 입력하세요'); }
}
async function toggleCoupon(id, active) { await api('/api/owner/coupons/' + id, { method: 'PATCH', body: { is_active: active } }); loadCoupons(); }
async function useCoupon() {
  try {
    const { redemption } = await api('/api/owner/coupons/use', { method: 'POST', body: { code: $('cp-code').value } });
    toast(`✅ ${redemption.title} 사용 처리 완료`); $('cp-code').value = ''; loadCoupons();
  } catch (e) { toast('❌ 유효하지 않거나 이미 사용된 코드입니다'); }
}

// ---------- subscription (Toss Payments 정기결제) ----------
async function loadSubscription() {
  const [plansRes, cur] = await Promise.all([api('/api/subs/plans'), api('/api/subs/current')]);
  plansInfo = plansRes;
  const sub = cur.subscription;

  $('current-sub').innerHTML = sub
    ? `<div class="note" style="border:1px solid var(--green)">✅ 현재 <b>${sub.plan.toUpperCase()}</b> 플랜 구독 중 · 월 ${Number(sub.price).toLocaleString()}원 · 다음 결제일 ${String(sub.next_billing_at).slice(0, 10)} · ${esc(sub.card_summary || '')}
       <button class="ghost" onclick="cancelSub()" style="margin-left:10px">구독 해지</button></div>`
    : `<div class="sub">현재 Free 플랜입니다. 기본 매장 페이지와 이벤트 등록은 무료로 제공됩니다.</div>`;

  $('plan-cards').innerHTML = Object.entries(plansRes.plans).map(([key, p]) => `
    <div class="plan ${key === 'pro' ? 'hot' : ''}">
      <div style="display:flex;justify-content:space-between"><b>${p.name}</b>${key === 'pro' ? '<span class="badge" style="color:var(--pink);border-color:var(--pink)">인기</span>' : ''}</div>
      <div class="price">₩${p.price.toLocaleString()}<span style="font-size:13px;color:var(--sub)">/월</span></div>
      <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
      <button class="${key === 'pro' ? '' : 'blue'}" onclick="subscribe('${key}')" ${sub && sub.plan === key ? 'disabled' : ''} style="width:100%">
        ${sub && sub.plan === key ? '구독 중' : '카드로 정기결제 시작'}
      </button>
      ${plansRes.test_mode ? `<button class="ghost" onclick="simulateSub('${key}')" style="width:100%">테스트 모드로 구독 (결제 없음)</button>` : ''}
    </div>`).join('');

  $('pay-note').innerHTML = plansRes.test_mode
    ? '🧪 <b>테스트 모드</b>: 서버에 토스페이먼츠 키가 없어 모의 결제로 작동합니다. 실결제 전환은 서버 환경변수 TOSS_CLIENT_KEY / TOSS_SECRET_KEY에 라이브 키를 넣으면 됩니다. 결제는 앱 외부(웹)에서 처리되어 앱스토어 수수료가 없습니다.'
    : '💳 토스페이먼츠 정기결제(빌링)로 안전하게 처리됩니다. 카드 정보는 KR NIGHT 서버에 저장되지 않습니다.';

  if (cur.payments && cur.payments.length) {
    $('pay-history-h').classList.remove('hidden');
    $('pay-history').innerHTML = cur.payments.map((p) => `<div class="row"><div>${String(p.paid_at).slice(0, 10)} · ${p.order_id}</div><div><b>₩${Number(p.amount).toLocaleString()}</b> <span class="badge" style="color:var(--${p.status === 'paid' ? 'green' : 'yellow'});border-color:var(--${p.status === 'paid' ? 'green' : 'yellow'})">${p.status}</span></div></div>`).join('');
  } else {
    $('pay-history-h').classList.add('hidden');
    $('pay-history').innerHTML = '';
  }
}

async function subscribe(plan) {
  const customerKey = 'krn-owner-' + Date.now();
  sessionStorage.setItem('krn_plan', plan);
  sessionStorage.setItem('krn_customer_key', customerKey);
  try {
    const toss = TossPayments(plansInfo.toss_client_key);
    await toss.requestBillingAuth('카드', {
      customerKey,
      successUrl: location.origin + '/dashboard/?billing=success',
      failUrl: location.origin + '/dashboard/?billing=fail',
    });
  } catch (e) {
    if (e && e.code === 'USER_CANCEL') return;
    toast('카드 등록 창을 열 수 없습니다. 테스트 모드 버튼을 사용해보세요.');
  }
}

async function simulateSub(plan) {
  try {
    await api('/api/subs/simulate', { method: 'POST', body: { plan } });
    toast('🧪 테스트 구독 활성화 완료'); loadSubscription(); loadStats();
  } catch (e) { toast('실패: ' + (e.code === 'NO_VENUE' ? '먼저 매장을 등록하세요' : e.message)); }
}

async function cancelSub() {
  if (!confirm('구독을 해지할까요? Free 플랜으로 전환됩니다.')) return;
  await api('/api/subs/cancel', { method: 'POST' });
  toast('구독이 해지되었습니다'); loadSubscription(); loadStats();
}

// handle Toss billing redirect
async function handleBillingRedirect() {
  const params = new URLSearchParams(location.search);
  if (params.get('billing') === 'success' && params.get('authKey')) {
    try {
      await api('/api/subs/confirm-billing', { method: 'POST', body: {
        authKey: params.get('authKey'),
        customerKey: params.get('customerKey') || sessionStorage.getItem('krn_customer_key'),
        plan: sessionStorage.getItem('krn_plan') || 'growth',
      }});
      toast('🎉 구독이 시작되었습니다!');
    } catch (e) { toast('결제 확인 실패: ' + (e.data?.message || e.message)); }
    history.replaceState({}, '', '/dashboard/');
  } else if (params.get('billing') === 'fail') {
    toast('카드 등록이 취소/실패했습니다');
    history.replaceState({}, '', '/dashboard/');
  }
}

// ---------- boot ----------
async function boot() {
  if (!token) return;
  try {
    const { user } = await api('/api/auth/me');
    if (user.role !== 'owner' && user.role !== 'admin') return logout();
    $('view-login').classList.add('hidden');
    $('view-app').classList.remove('hidden');
    $('btn-logout').classList.remove('hidden');
    await handleBillingRedirect();
    showTab('overview');
    showTab('subscribe'); // preload then return
    showTab('overview');
  } catch (e) { logout(); }
}
boot();
