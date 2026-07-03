import React from 'react';
import { View, Text } from 'react-native';
import { Card, Row, Sub, Badge, P } from '../ui';
import { C, areaName, catInfo } from '../theme';
import { useApp } from '../store';

export default function VenueCard({ venue, onPress }) {
  const { lang, t } = useApp();
  const cat = catInfo(venue.category);
  const name = lang === 'ko' ? venue.name : venue.name_en || venue.name;
  const live = Number(venue.live_count || 0);
  return (
    <Card onPress={onPress}>
      <Row>
        <View style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: venue.cover_color || C.purple, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 26 }}>{venue.cover_emoji || '🎶'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <P style={{ fontWeight: '800', fontSize: 16, flex: 1 }} numberOfLines={1}>{name}</P>
            {venue.plan === 'pro' && <Badge label="HOT" color={C.yellow} />}
          </Row>
          <Sub style={{ marginTop: 2 }}>
            {cat.emoji} {cat[lang] || cat.en} · {areaName(venue.area, lang)} · {venue.price_range}
          </Sub>
          <Row style={{ marginTop: 6, flexWrap: 'wrap' }}>
            {venue.foreigner_friendly && <Badge label={`🌏 ${t('foreigner_ok')}`} color={C.green} />}
            {live > 0 && <Badge label={`🔥 ${live}${t('live_now_count')}`} color={C.pink} />}
          </Row>
        </View>
      </Row>
    </Card>
  );
}
