import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../store';
import { api, getBaseUrl } from '../api';
import { C } from '../theme';
import { Screen, Card, Row, P, Sub, Btn, BtnOutline, H2, Input, Badge } from '../ui';

export default function OwnerScreen({ navigation }) {
  const { t } = useApp();
  const [data, setData] = useState(null);
  const [noVenue, setNoVenue] = useState(false);
  const [guests, setGuests] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  // quick venue creation
  const [vName, setVName] = useState('');
  const [vArea, setVArea] = useState('itaewon');
  const [vCat, setVCat] = useState('bar');

  const load = async () => {
    try {
      const d = await api('/api/owner/stats');
      setData(d);
      setNoVenue(false);
      const g = await api('/api/owner/checkins/today');
      setGuests(g.checkins);
    } catch (e) {
      if (e.code === 'NO_VENUE') setNoVenue(true);
    }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const createVenue = async () => {
    try {
      await api('/api/owner/venue', { method: 'POST', body: { name: vName, area: vArea, category: vCat } });
      load();
    } catch (e) { Alert.alert('KR NIGHT', t('error_generic')); }
  };

  const verifyCoupon = async () => {
    try {
      const { redemption } = await api('/api/owner/coupons/use', { method: 'POST', body: { code: couponCode } });
      Alert.alert('✅', `${redemption.title}\n${redemption.code}`);
      setCouponCode('');
    } catch (e) {
      Alert.alert('❌', '유효하지 않거나 이미 사용된 코드입니다\nInvalid or already used code');
    }
  };

  if (noVenue) {
    return (
      <Screen scroll>
        <H2>🏪 매장 등록 / Register your venue</H2>
        <Input placeholder="매장 이름 / Venue name" value={vName} onChangeText={setVName} />
        <Input placeholder="지역 (itaewon/hongdae/apgujeong/gangnam/seongsu/euljiro)" value={vArea} onChangeText={setVArea} autoCapitalize="none" />
        <Input placeholder="종류 (club/bar/lounge/pocha)" value={vCat} onChangeText={setVCat} autoCapitalize="none" />
        <Btn title="등록 / Register" onPress={createVenue} disabled={!vName} />
        <Sub style={{ marginHorizontal: 16 }}>상세 정보·사진·이벤트·쿠폰은 웹 대시보드에서 관리합니다.</Sub>
      </Screen>
    );
  }

  if (!data) return <Screen><Sub style={{ margin: 16 }}>{t('loading')}</Sub></Screen>;
  const { venue, stats } = data;

  return (
    <Screen scroll>
      <Row style={{ marginHorizontal: 16, marginTop: 12, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{venue.cover_emoji} {venue.name}</Text>
          <Sub>{venue.area} · {venue.category}</Sub>
        </View>
        <Badge label={venue.plan.toUpperCase()} color={venue.plan === 'pro' ? C.yellow : venue.plan === 'growth' ? C.blue : C.sub} />
      </Row>

      <Btn title={`📷 ${t('scan_qr')}`} color={C.pink} onPress={() => navigation.navigate('Scanner')} />

      {/* stats */}
      <Row style={{ marginTop: 4 }}>
        {[
          { label: t('live_now'), val: stats.live_now, color: C.green },
          { label: t('today'), val: stats.checkins_today, color: C.pink },
          { label: t('this_week'), val: stats.checkins_7d, color: C.blue },
        ].map((x, i) => (
          <Card key={i} style={{ flex: 1, alignItems: 'center', marginHorizontal: i === 1 ? 4 : 16, marginLeft: i === 0 ? 16 : 4, marginRight: i === 2 ? 16 : 4 }}>
            <Text style={{ color: x.color, fontSize: 26, fontWeight: '900' }}>{x.val}</Text>
            <Sub style={{ fontSize: 11 }}>{x.label}</Sub>
          </Card>
        ))}
      </Row>

      {/* coupon verify */}
      <H2>🎟️ {t('use_coupon_code')}</H2>
      <Row>
        <Input placeholder="KRN-XXXXXX" value={couponCode} onChangeText={setCouponCode} autoCapitalize="characters" style={{ flex: 1, marginRight: 4 }} />
        <BtnOutline title="✓" onPress={verifyCoupon} style={{ paddingHorizontal: 20, marginLeft: 0 }} />
      </Row>

      {/* today's guests */}
      <H2>👥 {t('todays_guests')} ({guests.length})</H2>
      {guests.map((g) => (
        <Card key={g.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <P>{g.avatar_emoji} {g.nickname} <Sub>@{g.handle}</Sub></P>
            <Sub>{new Date(g.checked_in_at).toLocaleTimeString().slice(0, 5)} · +{g.points_awarded}P</Sub>
          </Row>
        </Card>
      ))}
      {guests.length === 0 && <Sub style={{ marginHorizontal: 16 }}>—</Sub>}

      <Card style={{ marginTop: 16, borderColor: C.blue }}>
        <P style={{ fontWeight: '700', color: C.blue }}>💻 Web Dashboard</P>
        <Sub style={{ marginTop: 4 }}>{t('open_dashboard')}</Sub>
        <Sub style={{ marginTop: 6, color: C.text }} selectable>{getBaseUrl()}/dashboard</Sub>
      </Card>
    </Screen>
  );
}
