import React, { useCallback, useState } from 'react';
import { View, Text, Linking, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../store';
import { api } from '../api';
import { C, areaName, catInfo } from '../theme';
import { Screen, Card, Row, P, Sub, Badge, Btn, BtnOutline, H2 } from '../ui';

export default function VenueDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { t, lang, refreshMe } = useApp();
  const [data, setData] = useState(null);

  const load = async () => {
    try {
      const d = await api(`/api/venues/${id}`);
      setData(d);
      navigation.setOptions({ title: lang === 'ko' ? d.venue.name : d.venue.name_en || d.venue.name });
    } catch (e) {}
  };
  useFocusEffect(useCallback(() => { load(); }, [id, lang]));

  if (!data) return <Screen><Sub style={{ margin: 16 }}>{t('loading')}</Sub></Screen>;
  const { venue: v, events, coupons, live_count, saved, checked_in_here } = data;
  const cat = catInfo(v.category);
  const desc = v[`description_${lang}`] || v.description_en || v.description_ko;
  const rules = v[`entry_rules_${lang}`] || v.entry_rules_en || v.entry_rules_ko;
  const entryLabel = { easy: t('entry_easy'), normal: t('entry_normal'), strict: t('entry_strict') }[v.entry_difficulty];

  const openMaps = () => {
    const q = encodeURIComponent(`${v.name} ${v.address || ''}`);
    const urls = lang === 'ko'
      ? [`nmap://search?query=${q}`, `https://map.naver.com/v5/search/${q}`]
      : [`https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`];
    Linking.openURL(urls[0]).catch(() => urls[1] && Linking.openURL(urls[1]));
  };

  const toggleSave = async () => {
    await api(`/api/venues/${v.id}/save`, { method: 'POST' });
    load();
  };

  const redeem = async (c) => {
    try {
      const { redemption } = await api('/api/points/redeem', { method: 'POST', body: { coupon_id: c.id } });
      await refreshMe();
      Alert.alert('🎟️ ' + c.title, `CODE: ${redemption.code}\n\n${t('qr_desc')}`);
      load();
    } catch (e) {
      Alert.alert('KR NIGHT', e.code === 'NOT_ENOUGH_POINTS' ? '포인트가 부족합니다 / Not enough points' : t('error_generic'));
    }
  };

  return (
    <Screen scroll>
      {/* hero */}
      <View style={{ height: 150, backgroundColor: v.cover_color || C.purple, margin: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 60 }}>{v.cover_emoji}</Text>
        {Number(live_count) > 0 && (
          <View style={{ position: 'absolute', top: 12, right: 12 }}>
            <Badge label={`🔥 ${live_count}${t('live_now_count')}`} color={C.yellow} />
          </View>
        )}
      </View>

      <Row style={{ marginHorizontal: 16, flexWrap: 'wrap' }}>
        <Badge label={`${cat.emoji} ${cat[lang] || cat.en}`} color={C.purple} />
        <Badge label={areaName(v.area, lang)} color={C.blue} />
        {v.foreigner_friendly && <Badge label={`🌏 ${t('foreigner_ok')}`} color={C.green} />}
        <Badge label={entryLabel} color={v.entry_difficulty === 'strict' ? C.danger : C.sub} />
        <Badge label={v.price_range} color={C.yellow} />
      </Row>

      <Card>
        <P>{desc}</P>
        <Sub style={{ marginTop: 8 }}>🕒 {t('open_hours')}: {v.open_hours}</Sub>
        <Sub style={{ marginTop: 2 }}>👔 {t('dress_code')}: {v.dress_code}</Sub>
        {!!v.genres && <Sub style={{ marginTop: 2 }}>🎵 {v.genres.split(',').map((g) => `#${g.trim()}`).join(' ')}</Sub>}
        {!!v.address && <Sub style={{ marginTop: 2 }}>📍 {v.address}</Sub>}
        {!!v.instagram && (
          <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${v.instagram}`)}>
            <Sub style={{ marginTop: 2, color: C.pink }}>📸 @{v.instagram}</Sub>
          </TouchableOpacity>
        )}
      </Card>

      {!!rules && (
        <Card style={{ borderColor: C.blue }}>
          <P style={{ fontWeight: '700', color: C.blue, marginBottom: 4 }}>🎫 {t('entry_rules')}</P>
          <P style={{ fontSize: 14 }}>{rules}</P>
        </Card>
      )}

      <Row style={{ marginHorizontal: 0 }}>
        <View style={{ flex: 1 }}><BtnOutline title={`🧭 ${t('directions')}`} onPress={openMaps} /></View>
        <View style={{ flex: 1 }}><BtnOutline title={saved ? `💜 ${t('saved')}` : `🤍 ${t('save')}`} onPress={toggleSave} color={C.purple} /></View>
      </Row>

      {/* Lounge */}
      {checked_in_here ? (
        <Btn title={`💬 ${t('enter_lounge')}`} color={C.green}
          onPress={() => navigation.navigate('Lounge', { venueId: v.id, venueName: lang === 'ko' ? v.name : v.name_en })} />
      ) : (
        <Card style={{ backgroundColor: C.card2 }}>
          <Sub>🔒 {t('lounge_locked')}</Sub>
        </Card>
      )}

      {events.length > 0 && (
        <>
          <H2>📅 {t('upcoming_events')}</H2>
          {events.map((e) => (
            <Card key={e.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <P style={{ fontWeight: '700', flex: 1 }}>{e.title}</P>
                <Sub>{String(e.event_date).slice(0, 10)}</Sub>
              </Row>
              {!!e.lineup && <Sub style={{ marginTop: 4 }}>🎧 {e.lineup}</Sub>}
              {!!e.price && <Sub style={{ marginTop: 2 }}>💰 {e.price}</Sub>}
            </Card>
          ))}
        </>
      )}

      {coupons.length > 0 && (
        <>
          <H2>🎟️ {t('benefits')}</H2>
          {coupons.map((c) => (
            <Card key={c.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <P style={{ fontWeight: '700' }}>{c.title}</P>
                  {!!c.description && <Sub style={{ marginTop: 2 }}>{c.description}</Sub>}
                </View>
                <TouchableOpacity onPress={() => redeem(c)} style={{ backgroundColor: c.points_cost > 0 ? C.pink : C.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {c.points_cost > 0 ? `${c.points_cost}${t('points_suffix')} ${t('redeem')}` : t('free_benefit')}
                  </Text>
                </TouchableOpacity>
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
