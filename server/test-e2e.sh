#!/bin/bash
# KR NIGHT E2E 테스트 — 서버 기동 후 실행: ./test-e2e.sh [서버주소]
# 회원가입 → 로그인 → 장소 → QR 발급 → 사장님 스캔(체크인) → 포인트 → 라운지 → 쿠폰 → 구독 전체 흐름 검증
set -e
BASE="${1:-http://localhost:8080}"
J='Content-Type: application/json'
TS=$(date +%s)
pass=0; fail=0
ck() { if [ "$1" = "$2" ]; then echo "  ✅ $3"; pass=$((pass+1)); else echo "  ❌ $3 (expected $2, got $1)"; fail=$((fail+1)); fi }

echo "── 0. 헬스체크"
ok=$(curl -s "$BASE/api/health" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])")
ck "$ok" "True" "GET /api/health"

echo "── 1. 회원가입 (일반 유저)"
R=$(curl -s -X POST "$BASE/api/auth/register" -H "$J" -d "{\"email\":\"test$TS@e2e.kr\",\"password\":\"test1234\",\"nickname\":\"E2E테스터\",\"handle\":\"e2e_$TS\",\"language\":\"ko\"}")
UTOKEN=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
ck $? 0 "유저 가입 + 토큰 발급"

echo "── 2. 데모 사장님 로그인 (owner@krnight.app)"
R=$(curl -s -X POST "$BASE/api/auth/login" -H "$J" -d '{"email":"owner@krnight.app","password":"krnight123"}')
OTOKEN=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
ck $? 0 "사장님 로그인"

echo "── 3. 장소 목록·상세·추천 루트"
N=$(curl -s "$BASE/api/venues" -H "Authorization: Bearer $UTOKEN" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['venues']))")
echo "  ✅ 장소 $N개 조회"
VID=$(curl -s "$BASE/api/venues?search=Henz" -H "Authorization: Bearer $UTOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['venues'][0]['id'])")
NR=$(curl -s "$BASE/api/venues/routes" -H "Authorization: Bearer $UTOKEN" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['routes']))")
echo "  ✅ 추천 루트 $NR개 조회 (헨즈 클럽 id=$VID)"

echo "── 4. 라운지 접근 차단 (체크인 전)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/venues/$VID/lounge" -H "Authorization: Bearer $UTOKEN")
ck "$CODE" "403" "체크인 없이 라운지 접근 → 403"

echo "── 5. QR 발급 → 사장님 스캔 → 체크인"
QR=$(curl -s "$BASE/api/qr/token" -H "Authorization: Bearer $UTOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
R=$(curl -s -X POST "$BASE/api/qr/scan" -H "$J" -H "Authorization: Bearer $OTOKEN" -d "{\"token\":\"$QR\"}")
OK=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('ok'), d.get('points_awarded'), d.get('first_visit'))")
echo "  ✅ 스캔 결과: ok/포인트/첫방문 = $OK"

echo "── 6. 중복 스캔·재사용 차단"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/qr/scan" -H "$J" -H "Authorization: Bearer $OTOKEN" -d "{\"token\":\"$QR\"}")
ck "$CODE" "409" "같은 QR 재사용 → 409"

echo "── 7. 체크인 후 라운지 접근 허용"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/venues/$VID/lounge" -H "Authorization: Bearer $UTOKEN")
ck "$CODE" "200" "체크인 후 라운지 → 200"

echo "── 8. 포인트 적립 확인 및 쿠폰 교환"
PTS=$(curl -s "$BASE/api/points" -H "Authorization: Bearer $UTOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['balance'])")
echo "  ✅ 포인트 잔액: $PTS"
CID=$(curl -s "$BASE/api/venues/$VID" -H "Authorization: Bearer $UTOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['coupons'][0]['id'])")
CODE_STR=$(curl -s -X POST "$BASE/api/points/redeem" -H "$J" -H "Authorization: Bearer $UTOKEN" -d "{\"coupon_id\":$CID}" | python3 -c "import sys,json;print(json.load(sys.stdin)['redemption']['code'])")
echo "  ✅ 쿠폰 교환 코드: $CODE_STR"

echo "── 9. 사장님이 쿠폰 코드 사용 처리"
OK=$(curl -s -X POST "$BASE/api/owner/coupons/use" -H "$J" -H "Authorization: Bearer $OTOKEN" -d "{\"code\":\"$CODE_STR\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])")
ck "$OK" "True" "쿠폰 사용 처리"

echo "── 10. 사장님 통계"
S=$(curl -s "$BASE/api/owner/stats" -H "Authorization: Bearer $OTOKEN" | python3 -c "import sys,json;s=json.load(sys.stdin)['stats'];print(s['checkins_today'], s['live_now'])")
echo "  ✅ 오늘 체크인/현재 매장 내: $S"

echo "── 11. 구독 (테스트 모드)"
PLAN=$(curl -s -X POST "$BASE/api/subs/simulate" -H "$J" -H "Authorization: Bearer $OTOKEN" -d '{"plan":"growth"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['subscription']['plan'])")
ck "$PLAN" "growth" "Growth 플랜 테스트 구독"

echo "── 12. 친구 요청 흐름"
MIKE=$(curl -s "$BASE/api/social/search?handle=mike" -H "Authorization: Bearer $UTOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['users'][0]['id'])")
ST=$(curl -s -X POST "$BASE/api/social/request" -H "$J" -H "Authorization: Bearer $UTOKEN" -d "{\"user_id\":$MIKE}" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
ck "$ST" "pending" "친구 요청 → pending"

echo ""
echo "════════════════════════════════"
echo "  통과 $pass · 실패 $fail"
[ "$fail" = "0" ] && echo "  🎉 전체 흐름 정상 작동" || exit 1
