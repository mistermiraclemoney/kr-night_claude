import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useApp } from '../store';
import { api } from '../api';
import { C } from '../theme';
import { Screen, P, Sub, Btn } from '../ui';

export default function ScannerScreen({ navigation }) {
  const { t } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState(null); // {ok, guest, points_awarded, first_visit} | {error}
  const busy = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, [permission]);

  const onScan = async ({ data }) => {
    if (busy.current || result) return;
    busy.current = true;
    try {
      const res = await api('/api/qr/scan', { method: 'POST', body: { token: data } });
      setResult(res);
    } catch (e) {
      setResult({
        error: e.code === 'ALREADY_CHECKED_IN' ? t('already_checked_in')
          : e.code === 'QR_EXPIRED_OR_INVALID' || e.code === 'QR_ALREADY_USED' ? t('qr_invalid')
          : t('error_generic'),
        guest: e.data && e.data.guest,
      });
    } finally {
      setTimeout(() => { busy.current = false; }, 800);
    }
  };

  if (!permission) return <Screen />;
  if (!permission.granted) {
    return (
      <Screen>
        <P style={{ margin: 20, textAlign: 'center' }}>카메라 권한이 필요합니다{'\n'}Camera permission required</P>
        <Btn title="OK" onPress={requestPermission} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: 0 }}>
      {!result ? (
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <View style={{ width: 240, height: 240, borderWidth: 3, borderColor: C.pink, borderRadius: 24 }} />
            <P style={{ marginTop: 16, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 6 }}>
              게스트의 QR 패스를 스캔하세요
            </P>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {result.ok ? (
            <>
              <Text style={{ fontSize: 64 }}>✅</Text>
              <Text style={{ color: C.green, fontSize: 26, fontWeight: '900', marginTop: 10 }}>{t('checkin_success')}</Text>
              <Text style={{ fontSize: 40, marginTop: 16 }}>{result.guest.avatar_emoji}</Text>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{result.guest.nickname}</Text>
              <Sub>@{result.guest.handle}</Sub>
              {result.first_visit && <Text style={{ color: C.yellow, fontWeight: '800', marginTop: 8 }}>🌟 {t('first_visit')}</Text>}
              <Text style={{ color: C.pink, fontSize: 18, fontWeight: '800', marginTop: 8 }}>+{result.points_awarded}P</Text>
              <Sub style={{ marginTop: 10 }}>💡 실물 신분증으로 연령을 확인하세요 · Verify age with photo ID</Sub>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 64 }}>⚠️</Text>
              <P style={{ fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>{result.error}</P>
              {result.guest && <Sub style={{ marginTop: 6 }}>{result.guest.avatar_emoji} {result.guest.nickname}</Sub>}
            </>
          )}
          <Btn title="다음 스캔 / Next scan" onPress={() => setResult(null)} style={{ alignSelf: 'stretch', marginTop: 30 }} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 10 }}>
            <Sub>← Back</Sub>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}
