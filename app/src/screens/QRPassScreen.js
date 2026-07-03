import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../store';
import { api } from '../api';
import { C } from '../theme';
import { Screen, P, Sub } from '../ui';

export default function QRPassScreen() {
  const { t, user } = useApp();
  const [token, setToken] = useState(null);
  const [ttl, setTtl] = useState(90);

  const fetchToken = async () => {
    try {
      const { token: qr, ttl_seconds } = await api('/api/qr/token');
      setToken(qr);
      setTtl(ttl_seconds - 10);
    } catch (e) {}
  };

  useEffect(() => {
    fetchToken();
    const countdown = setInterval(() => {
      setTtl((s) => {
        if (s <= 1) { fetchToken(); return 80; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30 }}>{user.avatar_emoji}</Text>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{user.nickname}</Text>
        <Sub>@{user.handle}</Sub>
        <View style={{ backgroundColor: '#fff', padding: 22, borderRadius: 24, marginTop: 24, borderWidth: 3, borderColor: C.pink }}>
          {token ? <QRCode value={token} size={230} backgroundColor="#fff" color="#0B0B14" /> : <Sub>{t('loading')}</Sub>}
        </View>
        <P style={{ marginTop: 18, fontWeight: '700' }}>{t('qr_desc')}</P>
        <Sub style={{ marginTop: 6 }}>🔄 {ttl}{t('qr_refresh')}</Sub>
        <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 12, marginTop: 20, marginHorizontal: 30 }}>
          <Sub style={{ textAlign: 'center', fontSize: 11 }}>
            보안을 위해 QR은 90초마다 자동으로 바뀝니다.{'\n'}This QR rotates every 90 seconds for security.
          </Sub>
        </View>
      </View>
    </Screen>
  );
}
