import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../store';
import { api } from '../api';
import { C, AREAS, areaName } from '../theme';
import { Screen, H2, Sub, Card, Row, Chip, P, Badge } from '../ui';
import { LANGS } from '../i18n';
import VenueCard from '../components/VenueCard';

export default function HomeScreen({ navigation }) {
  const { t, lang, setLang, user, activeCheckin } = useApp();
  const [area, setArea] = useState('');
  const [venues, setVenues] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showLang, setShowLang] = useState(false);

  const load = async (a = area) => {
    try {
      const [v, r] = await Promise.all([
        api(`/api/venues${a ? `?area=${a}` : ''}`),
        api(`/api/venues/routes${a ? `?area=${a}` : ''}`),
      ]);
      setVenues(v.venues);
      setRoutes(r.routes);
    } catch (e) {}
  };

  useFocusEffect(useCallback(() => { load(); }, [area]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.pink} />} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* header */}
        <Row style={{ justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900' }}>
              <Text style={{ color: C.blue }}>KR</Text><Text style={{ color: C.pink }}> NIGHT</Text>
            </Text>
            <Sub>{t('tonight_where')} {user ? `· ${user.avatar_emoji} ${user.nickname}` : ''}</Sub>
          </View>
          <TouchableOpacity onPress={() => setShowLang(!showLang)} style={{ padding: 8, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text }}>{LANGS.find((l) => l.key === lang)?.flag} {lang.toUpperCase()}</Text>
          </TouchableOpacity>
        </Row>
        {showLang && (
          <Row style={{ marginHorizontal: 16, marginTop: 8 }}>
            {LANGS.map((l) => (
              <Chip key={l.key} label={`${l.flag} ${l.label}`} active={lang === l.key} onPress={() => { setLang(l.key); setShowLang(false); }} />
            ))}
          </Row>
        )}

        {/* active checkin banner */}
        {activeCheckin && (
          <Card style={{ borderColor: C.green, backgroundColor: C.green + '14' }} onPress={() => navigation.navigate('Lounge', { venueId: activeCheckin.venue_id, venueName: activeCheckin.venue_name })}>
            <P style={{ color: C.green, fontWeight: '700' }}>📍 {activeCheckin.venue_name}</P>
            <Sub>{t('checked_in_here')} → {t('enter_lounge')}</Sub>
          </Card>
        )}

        {/* area chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <Chip label={t('all_areas')} active={!area} onPress={() => setArea('')} />
          {AREAS.map((a) => (
            <Chip key={a.key} label={a[lang] || a.en} active={area === a.key} onPress={() => setArea(a.key)} />
          ))}
        </ScrollView>

        {/* tonight's routes */}
        {routes.length > 0 && (
          <>
            <H2>🗺️ {t('tonight_route')}</H2>
            {routes.map((r) => (
              <Card key={r.id}>
                <P style={{ fontWeight: '800', marginBottom: 8 }}>{lang === 'ko' ? r.title_ko : r.title_en || r.title_ko}</P>
                {r.stops.map((s, i) => (
                  <TouchableOpacity key={i} onPress={() => s.venue && navigation.navigate('VenueDetail', { id: s.venue.id })}>
                    <Row style={{ marginVertical: 5 }}>
                      <Text style={{ color: C.pink, fontWeight: '800', width: 52, fontSize: 13 }}>{s.time}</Text>
                      <Text style={{ fontSize: 16, marginRight: 6 }}>{s.venue?.cover_emoji || '🎶'}</Text>
                      <View style={{ flex: 1 }}>
                        <P style={{ fontSize: 14, fontWeight: '600' }}>{s.venue ? (lang === 'ko' ? s.venue.name : s.venue.name_en) : '-'}</P>
                        <Sub style={{ fontSize: 12 }}>{lang === 'ko' ? s.note_ko : s.note_en || s.note_ko}</Sub>
                      </View>
                      <Text style={{ color: C.sub }}>›</Text>
                    </Row>
                  </TouchableOpacity>
                ))}
              </Card>
            ))}
          </>
        )}

        {/* recommended venues */}
        <H2>✨ {t('recommended')}</H2>
        {venues.map((v) => (
          <VenueCard key={v.id} venue={v} onPress={() => navigation.navigate('VenueDetail', { id: v.id })} />
        ))}
        {venues.length === 0 && <Sub style={{ margin: 16 }}>{t('loading')}</Sub>}
      </ScrollView>
    </Screen>
  );
}
