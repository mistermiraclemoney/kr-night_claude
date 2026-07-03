import React, { useEffect, useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { useApp } from '../store';
import { C } from '../theme';
import { Screen, H1, Sub, Input, Btn, Row, P } from '../ui';
import { LANGS } from '../i18n';
import { getBaseUrl, setBaseUrl, loadPersisted } from '../api';

export default function AuthScreen() {
  const { t, lang, setLang, login, register } = useApp();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [handle, setHandle] = useState('');
  const [asOwner, setAsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverUrl, setServerUrl] = useState(getBaseUrl());
  const [showServer, setShowServer] = useState(false);

  useEffect(() => {
    loadPersisted().then(({ url }) => setServerUrl(url));
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await setBaseUrl(serverUrl);
      if (mode === 'login') await login(email.trim(), password);
      else await register({ email: email.trim(), password, nickname: nickname.trim(), handle: handle.trim().toLowerCase(), language: lang, asOwner });
    } catch (e) {
      const msg = {
        BAD_CREDENTIALS: '이메일 또는 비밀번호가 틀렸습니다 / Wrong email or password',
        ALREADY_EXISTS: '이미 사용 중인 이메일/ID입니다 / Email or ID already taken',
        INVALID_HANDLE: '유저 ID는 영문 소문자·숫자·_ 3~20자 / User ID: a-z, 0-9, _ (3-20)',
        PASSWORD_TOO_SHORT: '비밀번호는 6자 이상 / Password must be 6+ chars',
        MISSING_FIELDS: '모든 항목을 입력해주세요 / Fill in all fields',
      }[e.code] || `${t('error_generic')}\n(${e.message})\n\n서버 주소 확인: ${serverUrl}`;
      Alert.alert('KR NIGHT', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 8 }}>
            <Text style={{ fontSize: 56 }}>🐱</Text>
            <Text style={{ fontSize: 34, fontWeight: '900', marginTop: 8 }}>
              <Text style={{ color: C.blue }}>KR</Text>
              <Text style={{ color: C.pink }}> NIGHT</Text>
            </Text>
            <Sub style={{ marginTop: 4, letterSpacing: 1 }}>{t('slogan')}</Sub>
          </View>

          <Row style={{ justifyContent: 'center', marginVertical: 14 }}>
            {LANGS.map((l) => (
              <TouchableOpacity key={l.key} onPress={() => setLang(l.key)}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: lang === l.key ? C.card2 : 'transparent', marginHorizontal: 2, borderWidth: 1, borderColor: lang === l.key ? C.pink : 'transparent' }}>
                <Text style={{ color: lang === l.key ? C.text : C.sub, fontSize: 13 }}>{l.flag} {l.label}</Text>
              </TouchableOpacity>
            ))}
          </Row>

          <Input placeholder={t('email')} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Input placeholder={t('password')} secureTextEntry value={password} onChangeText={setPassword} />
          {mode === 'signup' && (
            <>
              <Input placeholder={t('nickname')} value={nickname} onChangeText={setNickname} />
              <Input placeholder={t('handle')} autoCapitalize="none" value={handle} onChangeText={setHandle} />
              <Row style={{ marginHorizontal: 20, marginVertical: 8, justifyContent: 'space-between' }}>
                <P style={{ color: C.sub, flex: 1 }}>{t('i_am_owner')}</P>
                <Switch value={asOwner} onValueChange={setAsOwner} trackColor={{ true: C.pink }} />
              </Row>
            </>
          )}

          <Btn title={busy ? '...' : mode === 'login' ? t('login') : t('signup')} onPress={submit} disabled={busy} />
          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={{ color: C.blue }}>{mode === 'login' ? t('no_account') : t('have_account')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowServer(!showServer)} style={{ alignItems: 'center', marginTop: 26 }}>
            <Sub>⚙️ {t('server_url')}</Sub>
          </TouchableOpacity>
          {showServer && (
            <Input placeholder="https://your-app.up.railway.app" autoCapitalize="none" value={serverUrl} onChangeText={setServerUrl} />
          )}

          <Sub style={{ textAlign: 'center', marginTop: 20, marginHorizontal: 30, fontSize: 11 }}>
            19+ · 책임 있는 음주 문화를 응원합니다 · Drink responsibly
          </Sub>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
