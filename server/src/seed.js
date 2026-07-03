// Seed sample data: venues (이태원/홍대 중심), events, coupons, routes, demo accounts.
// 모든 장소 정보는 데모용 샘플이며 실제 제휴 매장 정보로 교체해야 합니다.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { q, migrate, pool } = require('./db');

const VENUES = [
  // 이태원
  { name: '헨즈 클럽', name_en: 'Henz Club', area: 'itaewon', category: 'club', genres: 'hiphop,rnb',
    lat: 37.5346, lng: 126.9946, address: '서울 용산구 이태원로 지하 (샘플 주소)', instagram: 'henz_club',
    foreigner_friendly: true, entry_difficulty: 'normal', price_range: '₩₩₩', dress_code: 'Smart Casual',
    cover_emoji: '🐯', cover_color: '#E11D48', open_hours: '22:00 - 06:00',
    description_ko: '이태원 대표 힙합 클럽. 외국인 비율이 높고 금·토 새벽 피크.', description_en: 'Itaewon hip-hop staple. Very foreigner-friendly, peaks Fri/Sat 1-4am.',
    entry_rules_ko: '만 19세 이상 · 여권/신분증 필수 · 입장료 주말 20,000원(웰컴드링크 1잔)', entry_rules_en: '19+ · Passport/ID required · Weekend cover ₩20,000 incl. 1 drink' },
  { name: '문나이트 라운지', name_en: 'Moonnight Lounge', area: 'itaewon', category: 'lounge', genres: 'rnb,house',
    lat: 37.5339, lng: 126.9902, address: '서울 용산구 이태원동 (샘플 주소)', instagram: 'moonnight_lounge',
    foreigner_friendly: true, entry_difficulty: 'easy', price_range: '₩₩', dress_code: 'Casual',
    cover_emoji: '🌙', cover_color: '#7C3AED', open_hours: '20:00 - 04:00',
    description_ko: '칵테일과 R&B 중심의 여유로운 라운지. 1차로 좋다.', description_en: 'Relaxed cocktail lounge with R&B. Great first stop.',
    entry_rules_ko: '만 19세 이상 · 입장 무료 · 1인 1잔', entry_rules_en: '19+ · Free entry · One drink minimum' },
  { name: '글로벌 포차 이태원', name_en: 'Global Pocha Itaewon', area: 'itaewon', category: 'pocha', genres: 'kpop',
    lat: 37.5352, lng: 126.9928, address: '서울 용산구 이태원로 (샘플 주소)', instagram: 'global_pocha',
    foreigner_friendly: true, entry_difficulty: 'easy', price_range: '₩', dress_code: 'Anything',
    cover_emoji: '🍢', cover_color: '#F59E0B', open_hours: '18:00 - 05:00',
    description_ko: '새벽 마무리로 완벽한 한국식 포차. 영어 메뉴 있음.', description_en: 'Korean pocha perfect for the last stop. English menu available.',
    entry_rules_ko: '연령 제한 없음(주류는 19+) · 예약 불가', entry_rules_en: 'All ages (alcohol 19+) · No reservations' },
  // 홍대
  { name: '베이스 홍대', name_en: 'BASE Hongdae', area: 'hongdae', category: 'club', genres: 'hiphop,kpop',
    lat: 37.5533, lng: 126.9222, address: '서울 마포구 와우산로 (샘플 주소)', instagram: 'base_hongdae',
    foreigner_friendly: true, entry_difficulty: 'easy', price_range: '₩₩', dress_code: 'Casual',
    cover_emoji: '🔊', cover_color: '#2563EB', open_hours: '21:00 - 06:00',
    description_ko: '홍대 힙합·케이팝 클럽. 대학생과 여행객이 섞이는 곳.', description_en: 'Hongdae hip-hop/K-pop club. Students + travelers mix.',
    entry_rules_ko: '만 19세 이상 · 입장료 15,000원 · 신분증 필수', entry_rules_en: '19+ · Cover ₩15,000 · ID required' },
  { name: '테크노 서클', name_en: 'Techno Circle', area: 'hongdae', category: 'club', genres: 'techno,house',
    lat: 37.5498, lng: 126.9186, address: '서울 마포구 잔다리로 (샘플 주소)', instagram: 'techno_circle',
    foreigner_friendly: true, entry_difficulty: 'normal', price_range: '₩₩', dress_code: 'All Black Preferred',
    cover_emoji: '🎛️', cover_color: '#111827', open_hours: '23:00 - 07:00',
    description_ko: '언더그라운드 테크노. 음악에 진심인 사람들.', description_en: 'Underground techno. For people serious about music.',
    entry_rules_ko: '만 19세 이상 · 입장료 20,000원 · 사진 촬영 금지', entry_rules_en: '19+ · Cover ₩20,000 · No photos inside' },
  { name: '라이브 홀 502', name_en: 'Live Hall 502', area: 'hongdae', category: 'bar', genres: 'live,indie',
    lat: 37.5521, lng: 126.9244, address: '서울 마포구 어울마당로 (샘플 주소)', instagram: 'livehall502',
    foreigner_friendly: true, entry_difficulty: 'easy', price_range: '₩₩', dress_code: 'Casual',
    cover_emoji: '🎸', cover_color: '#10B981', open_hours: '19:00 - 02:00',
    description_ko: '인디 밴드 라이브 바. 공연 후 자연스러운 뒤풀이.', description_en: 'Indie live music bar. Natural afterparty vibes.',
    entry_rules_ko: '공연별 티켓 상이 · 19세 미만 보호자 동반', entry_rules_en: 'Ticket per show · Minors with guardian' },
  // 압구정/강남
  { name: '루프탑 아페로', name_en: 'Rooftop Apero', area: 'apgujeong', category: 'lounge', genres: 'house,rnb',
    lat: 37.5274, lng: 127.0286, address: '서울 강남구 압구정로 (샘플 주소)', instagram: 'rooftop_apero',
    foreigner_friendly: true, entry_difficulty: 'normal', price_range: '₩₩₩₩', dress_code: 'Dress to Impress',
    cover_emoji: '🥂', cover_color: '#D946EF', open_hours: '19:00 - 03:00',
    description_ko: '압구정 루프탑 라운지. VIP 테이블 중심.', description_en: 'Apgujeong rooftop lounge. VIP table focused.',
    entry_rules_ko: '만 19세 이상 · 드레스코드 엄격 · 테이블 예약 권장', entry_rules_en: '19+ · Strict dress code · Table booking recommended' },
  { name: '옥타 강남', name_en: 'OCTA Gangnam', area: 'gangnam', category: 'club', genres: 'edm,house',
    lat: 37.5040, lng: 127.0264, address: '서울 강남구 강남대로 (샘플 주소)', instagram: 'octa_gangnam',
    foreigner_friendly: false, entry_difficulty: 'strict', price_range: '₩₩₩₩', dress_code: 'Smart',
    cover_emoji: '💎', cover_color: '#0EA5E9', open_hours: '22:00 - 07:00',
    description_ko: '강남 대형 EDM 클럽. 입장 기준이 까다로운 편.', description_en: 'Big Gangnam EDM club. Door policy is strict.',
    entry_rules_ko: '만 19세 이상 · 복장 확인 · 만취 시 입장 불가', entry_rules_en: '19+ · Dress check · No entry if intoxicated' },
  // 성수/을지로
  { name: '수제맥주 창고', name_en: 'Craft Warehouse', area: 'seongsu', category: 'bar', genres: 'indie,live',
    lat: 37.5446, lng: 127.0559, address: '서울 성동구 연무장길 (샘플 주소)', instagram: 'craft_warehouse',
    foreigner_friendly: true, entry_difficulty: 'easy', price_range: '₩₩', dress_code: 'Anything',
    cover_emoji: '🍺', cover_color: '#F97316', open_hours: '17:00 - 01:00',
    description_ko: '성수 창고형 크래프트 비어 바. 이른 저녁 1차 추천.', description_en: 'Seongsu warehouse craft beer bar. Great early stop.',
    entry_rules_ko: '주류 구매 19+ · 반려동물 동반 가능(야외)', entry_rules_en: 'Alcohol 19+ · Pets OK (outdoor)' },
  { name: '을지 다락', name_en: 'Euljiro Darak', area: 'euljiro', category: 'bar', genres: 'jazz,indie',
    lat: 37.5663, lng: 126.9910, address: '서울 중구 을지로 (샘플 주소)', instagram: 'euljiro_darak',
    foreigner_friendly: true, entry_difficulty: 'easy', price_range: '₩₩', dress_code: 'Casual',
    cover_emoji: '🥃', cover_color: '#78716C', open_hours: '18:00 - 02:00',
    description_ko: '힙지로 숨은 위스키 바. 조용한 시작에 좋다.', description_en: 'Hidden whisky bar in Hipjiro. Good quiet start.',
    entry_rules_ko: '만 19세 이상 · 노키즈존', entry_rules_en: '19+ · No kids zone' },
];

async function seed() {
  await migrate();
  const { rows } = await q('SELECT COUNT(*) n FROM venues');
  if (Number(rows[0].n) > 0) {
    console.log('[seed] venues already exist, skipping');
    return;
  }

  console.log('[seed] inserting demo data...');
  const hash = await bcrypt.hash('krnight123', 10);

  // demo owner (헨즈 클럽 사장님) + demo users
  const owner = (await q(
    `INSERT INTO users (email, password_hash, nickname, handle, role, language, avatar_emoji)
     VALUES ('owner@krnight.app', $1, '헨즈 사장님', 'henz_owner', 'owner', 'ko', '🐯') RETURNING id`, [hash])).rows[0];
  const mike = (await q(
    `INSERT INTO users (email, password_hash, nickname, handle, role, language, avatar_emoji, location_sharing)
     VALUES ('mike@krnight.app', $1, 'Mike', 'mike_seoul', 'user', 'en', '🕺', TRUE) RETURNING id`, [hash])).rows[0];
  const yuna = (await q(
    `INSERT INTO users (email, password_hash, nickname, handle, role, language, avatar_emoji)
     VALUES ('yuna@krnight.app', $1, '유나', 'yuna_night', 'user', 'ko', '🦋') RETURNING id`, [hash])).rows[0];
  await q(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1,$2,'accepted')`, [mike.id, yuna.id]);

  const ids = {};
  for (const v of VENUES) {
    const r = await q(
      `INSERT INTO venues (name, name_en, area, category, genres, lat, lng, address, instagram,
        foreigner_friendly, entry_difficulty, price_range, dress_code, cover_emoji, cover_color, open_hours,
        description_ko, description_en, entry_rules_ko, entry_rules_en, owner_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
      [v.name, v.name_en, v.area, v.category, v.genres, v.lat, v.lng, v.address, v.instagram,
       v.foreigner_friendly, v.entry_difficulty, v.price_range, v.dress_code, v.cover_emoji, v.cover_color,
       v.open_hours, v.description_ko, v.description_en, v.entry_rules_ko, v.entry_rules_en,
       v.name_en === 'Henz Club' ? owner.id : null]
    );
    ids[v.name_en] = r.rows[0].id;
  }

  // events (this weekend)
  const ev = async (venue, title, days, lineup, price) =>
    q(`INSERT INTO events (venue_id, title, event_date, lineup, price) VALUES ($1,$2, CURRENT_DATE + $3::int, $4, $5)`,
      [ids[venue], title, days, lineup, price]);
  await ev('Henz Club', 'FRIDAY TAKEOVER', 1, 'DJ HYPE, DJ MOON', '₩20,000 (1 free drink)');
  await ev('Henz Club', 'HIPHOP SATURDAY', 2, 'DJ K-DASH', '₩20,000');
  await ev('BASE Hongdae', 'K-POP NIGHT', 1, 'DJ STELLA', '₩15,000');
  await ev('Techno Circle', 'WAREHOUSE 003', 2, 'B2B all night', '₩20,000');
  await ev('Live Hall 502', 'INDIE FRIDAY LIVE', 1, '밴드 3팀 합동 공연', '₩25,000 (티켓)');
  await ev('OCTA Gangnam', 'MAIN ROOM: EDM MADNESS', 2, 'Special guest DJ', '₩30,000');

  // coupons
  const cp = async (venue, title, desc, cost) =>
    q('INSERT INTO coupons (venue_id, title, description, points_cost) VALUES ($1,$2,$3,$4)',
      [ids[venue], title, desc, cost]);
  await cp('Henz Club', '웰컴 드링크 1잔', 'QR 체크인 후 바에서 코드 제시', 0);
  await cp('Henz Club', '입장료 50% 할인', '금요일 자정 전 입장 시', 200);
  await cp('Moonnight Lounge', '시그니처 칵테일 1+1', '첫 방문 환영 혜택', 100);
  await cp('BASE Hongdae', '무료 입장권', '평일 한정', 300);
  await cp('Craft Warehouse', '수제맥주 1잔 무료', '4,000 포인트 상당', 150);

  // tonight's routes (기획서 7.3 오늘의 추천 Route)
  const route = (area, tk, te, stops) =>
    q(`INSERT INTO night_routes (area, title_ko, title_en, title_ja, title_zh, stops) VALUES ($1,$2,$3,$4,$5,$6)`,
      [area, tk, te, tk, tk, JSON.stringify(stops)]);
  await route('itaewon', '이태원 클래식 나이트', 'Itaewon Classic Night', [
    { time: '21:00', venue_id: ids['Moonnight Lounge'], note_ko: '칵테일로 가볍게 시작', note_en: 'Ease in with cocktails' },
    { time: '23:30', venue_id: ids['Henz Club'], note_ko: '피크 타임 힙합', note_en: 'Peak-time hip-hop' },
    { time: '03:00', venue_id: ids['Global Pocha Itaewon'], note_ko: '포차에서 마무리', note_en: 'Wind down at the pocha' },
  ]);
  await route('hongdae', '홍대 사운드 트립', 'Hongdae Sound Trip', [
    { time: '20:00', venue_id: ids['Live Hall 502'], note_ko: '인디 라이브 1차', note_en: 'Indie live first' },
    { time: '23:00', venue_id: ids['BASE Hongdae'], note_ko: '케이팝·힙합 메인', note_en: 'K-pop/hip-hop main' },
    { time: '01:30', venue_id: ids['Techno Circle'], note_ko: '새벽은 테크노', note_en: 'Techno till sunrise' },
  ]);

  console.log('[seed] done.');
  console.log('  demo owner : owner@krnight.app / krnight123 (헨즈 클럽)');
  console.log('  demo users : mike@krnight.app, yuna@krnight.app / krnight123');
}

if (require.main === module) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { seed };
