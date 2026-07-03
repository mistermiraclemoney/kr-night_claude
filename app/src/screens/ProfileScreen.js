import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../store';
import { api } from '../api';
import { C } from '../theme';
import { Screen, Card, Row, P, Sub, Chip, H2, Btn, BtnOutline, Badge } from '../ui';
import { LANGS } from '../i18n';

export default function ProfileScreen({ navigation }) {
  const { t, lang, setLang, user, setUser, logout, activeCheckin, refreshMe, setActiveCheckin } = useApp();
  const [ledger, setLedger] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [saved, setSaved] = useState([]);
  const [history, setHistory] = useState([]);
  const [section, setSection] = useState('');

  const load = async () => {
    try {
      await refreshMe();
      const [p, c, s, h] = await Promise.all([
        api('/api/points'), api('/api/points/coupons'), api('/api/points/saved'), api('/api/qr/history'),
      ]);
      setLedger(p.ledger); setCoupons(c.coupons); setSaved(s.venues); setHistory(h.checkins);
    } catch (e) {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const toggleLocation = async (val) => {
    const { user: u } = await api('/api/auth/me', { method: 'PATCH', body: { location_sharing: val } });
    setUser(u);
  };

  const checkout = async () => {
    await api('/api/qr/checkout', { method: 'POST' });
    setActiveCheckin(null);
    refreshMe();
  };

  if (!user) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* profile header */}
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 54 }}>{user.avatar_emoji}</Text>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{user.nickname}</Text>
          <Sub>@{user.handle}</Sub>
          {activeCheckin && (
            <Row style={{ marginTop: 6 }}>
              <Badge label={`📍 ${activeCheckin.venue_name}`} color={C.green} />
              <TouchableOpacity onPress={checkout}><Sub style={{ color: C.danger }}>{t('checkout')}</Sub></TouchableOpacity>
            </Row>
          )}
        </View>

        {/* QR + points */}
        <Row style={{ marginTop: 16 }}>
          <Card style={{ flex: 1, marginRight: 4, alignItems: 'center' }} onPress={() => navigation.navigate('QRPass')}>
            <Text style={{ fontSize: 30 }}>📱</Text>
            <P style={{ fontWeight: '800', marginTop: 4 }}>{t('my_qr')}</P>
            <Sub style={{ fontSize: 11, textAlign: 'center' }}>{t('qr_desc')}</Sub>
          </Card>
          <Card style={{ flex: 1, marginLeft: 4, alignItems: 'center' }} onPress={() => setSection(section === 'points' ? '' : 'points')}>
            <Text style={{ fontSize: 30 }}>⭐</Text>
            <P style={{ fontWeight: '800', marginTop: 4 }}>{user.points} {t('points_suffix')}</P>
            <Sub style={{ fontSize: 11 }}>{t('points')}</Sub>
          </Card>
        </Row>

        {user.role === 'owner' && (
          <Btn title={`🏪 ${t('owner_mode')}`} color={C.purple} onPress={() => navigation.navigate('Owner')} />
        )}

        {/* language */}
        <H2>🌐 {t('language')}</H2>
        <Row style={{ marginHorizontal: 16 }}>
          {LANGS.map((l) => (
            <Chip key={l.key} label={`${l.flag} ${l.label}`} active={lang === l.key} onPress={() => setLang(l.key)} />
          ))}
        </Row>

        {/* location sharing */}
        <Card style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <P style={{ flex: 1, fontSize: 14 }}>📍 {t('location_sharing')}</P>
            <Switch value={!!user.location_sharing} onValueChange={toggleLocation} trackColor={{ true: C.green }} />
          </Row>
        </Card>

        {/* collapsible sections */}
        <Row style={{ marginHorizontal: 16, marginTop: 14, flexWrap: 'wrap' }}>
          <Chip label={`⭐ ${t('point_history')}`} active={section === 'points'} onPress={() => setSection(section === 'points' ? '' : 'points')} />
          <Chip label={`🎟️ ${t('my_coupons')}`} active={section === 'coupons'} onPress={() => setSection(section === 'coupons' ? '' : 'coupons')} />
          <Chip label={`💜 ${t('saved_places')}`} active={section === 'saved'} onPress={() => setSection(section === 'saved' ? '' : 'saved')} />
          <Chip label={`📍 ${t('checkin_history')}`} active={section === 'history'} onPress={() => setSection(section === 'history' ? '' : 'history')} />
        </Row>

        {section === 'points' && ledger.map((l) => (
          <Card key={l.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Sub>{l.reason}</Sub>
              <P style={{ color: l.delta > 0 ? C.green : C.danger, fontWeight: '700' }}>{l.delta > 0 ? '+' : ''}{l.delta}P</P>
            </Row>
          </Card>
        ))}

        {section === 'coupons' && coupons.map((c) => (
          <Card key={c.id} onPress={() => Alert.alert(`🎟️ ${c.title}`, `${c.venue_name}\n\nCODE: ${c.code}\n\n${c.used_at ? '✅ ' + t('used') : t('qr_desc')}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <P style={{ fontWeight: '700' }}>{c.cover_emoji} {c.title}</P>
                <Sub>{c.venue_name} · {c.code}</Sub>
              </View>
              <Badge label={c.used_at ? t('used') : t('show_code')} color={c.used_at ? C.sub : C.green} />
            </Row>
          </Card>
        ))}

        {section === 'saved' && saved.map((v) => (
          <Card key={v.id} onPress={() => navigation.navigate('VenueDetail', { id: v.id })}>
            <P>{v.cover_emoji} {lang === 'ko' ? v.name : v.name_en || v.name} <Sub>· {v.area}</Sub></P>
          </Card>
        ))}

        {section === 'history' && history.map((h) => (
          <Card key={h.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <P>{h.cover_emoji} {h.venue_name}</P>
              <Sub>+{h.points_awarded}P · {String(h.checked_in_at).slice(0, 10)}</Sub>
            </Row>
          </Card>
        ))}

        <BtnOutline title={t('logout')} color={C.danger} onPress={logout} style={{ marginTop: 20 }} />
        <Sub style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>KR NIGHT v1.0 · Tonight in South Korea</Sub>
      </ScrollView>
    </Screen>
  );
}
