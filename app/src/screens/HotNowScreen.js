import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { useApp } from '../store';
import { api } from '../api';
import { C, AREAS, CATEGORIES } from '../theme';
import { Screen, Chip, Row, Input, Sub } from '../ui';
import VenueCard from '../components/VenueCard';

const SEOUL = { latitude: 37.5446, longitude: 126.986, latitudeDelta: 0.09, longitudeDelta: 0.09 };

export default function HotNowScreen({ navigation }) {
  const { t, lang } = useApp();
  const [mode, setMode] = useState('list');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [foreigner, setForeigner] = useState(false);
  const [search, setSearch] = useState('');
  const [venues, setVenues] = useState([]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (area) params.set('area', area);
      if (category) params.set('category', category);
      if (foreigner) params.set('foreigner', '1');
      if (search) params.set('search', search);
      const { venues: v } = await api(`/api/venues?${params.toString()}`);
      setVenues(v);
    } catch (e) {}
  };

  useFocusEffect(useCallback(() => { load(); }, [area, category, foreigner, search]));

  return (
    <Screen>
      <Row style={{ marginHorizontal: 16, marginTop: 10, justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>🔥 Hot Now</Text>
        <Row>
          <Chip label={t('list')} active={mode === 'list'} onPress={() => setMode('list')} color={C.blue} />
          <Chip label={t('map')} active={mode === 'map'} onPress={() => setMode('map')} color={C.blue} />
        </Row>
      </Row>

      <Input placeholder={t('search_venues')} value={search} onChangeText={setSearch} autoCapitalize="none" />

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          <Chip label={t('all_areas')} active={!area} onPress={() => setArea('')} />
          {AREAS.map((a) => <Chip key={a.key} label={a[lang] || a.en} active={area === a.key} onPress={() => setArea(area === a.key ? '' : a.key)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          {CATEGORIES.map((c) => <Chip key={c.key} label={`${c.emoji} ${c[lang] || c.en}`} active={category === c.key} onPress={() => setCategory(category === c.key ? '' : c.key)} color={C.purple} />)}
          <Chip label={`🌏 ${t('foreigner_ok')}`} active={foreigner} onPress={() => setForeigner(!foreigner)} color={C.green} />
        </ScrollView>
      </View>

      {mode === 'map' ? (
        <View style={{ flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          <MapView style={{ flex: 1 }} initialRegion={SEOUL}>
            {venues.filter((v) => v.lat && v.lng).map((v) => (
              <Marker
                key={v.id}
                coordinate={{ latitude: v.lat, longitude: v.lng }}
                title={`${v.cover_emoji} ${lang === 'ko' ? v.name : v.name_en || v.name}`}
                description={`${v.price_range} · ${Number(v.live_count) > 0 ? `🔥 ${v.live_count}` : v.open_hours}`}
                onCalloutPress={() => navigation.navigate('VenueDetail', { id: v.id })}
              />
            ))}
          </MapView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {venues.map((v) => (
            <VenueCard key={v.id} venue={v} onPress={() => navigation.navigate('VenueDetail', { id: v.id })} />
          ))}
          {venues.length === 0 && <Sub style={{ margin: 16 }}>—</Sub>}
        </ScrollView>
      )}
    </Screen>
  );
}
