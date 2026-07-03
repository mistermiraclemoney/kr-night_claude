import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useApp } from '../store';
import { api } from '../api';
import { C } from '../theme';
import { Screen, Row, P, Sub, Input } from '../ui';

export default function LoungeScreen({ route, navigation }) {
  const { venueId, venueName } = route.params;
  const { t, user, socket } = useApp();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: `🍸 ${venueName}` });
    let mounted = true;
    (async () => {
      try {
        const d = await api(`/api/venues/${venueId}/lounge`);
        if (!mounted) return;
        setMessages(d.messages);
        setMembers(d.members);
      } catch (e) {
        Alert.alert('KR NIGHT', t('lounge_locked'));
        navigation.goBack();
        return;
      }
      const s = socket();
      if (s) {
        s.emit('lounge:join', venueId, () => {});
        s.on('lounge:message', onMsg);
        s.on('lounge:system', onSys);
      }
    })();
    return () => {
      mounted = false;
      const s = socket();
      if (s) {
        s.emit('lounge:leave', venueId);
        s.off('lounge:message', onMsg);
        s.off('lounge:system', onSys);
      }
    };
  }, [venueId]);

  const onMsg = (m) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  const onSys = (m) => setMessages((prev) => [...prev, { id: 'sys-' + Date.now(), system: true, body: m.text }]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const s = socket();
    if (s) s.emit('lounge:message', { venueId, body }, (res) => {
      if (res && res.error === 'CHECKIN_REQUIRED') Alert.alert('KR NIGHT', t('lounge_locked'));
    });
  };

  const reportMsg = (m) => {
    if (m.system || m.user_id === user.id) return;
    Alert.alert(t('report'), `@${m.handle}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: t('report'), style: 'destructive', onPress: () => api('/api/venues/report', { method: 'POST', body: { target_type: 'lounge_message', target_id: m.id, reason: 'inappropriate' } }) },
    ]);
  };

  const renderItem = ({ item: m }) => {
    if (m.system) return <Sub style={{ textAlign: 'center', marginVertical: 4, fontSize: 12 }}>{m.body}</Sub>;
    const mine = m.user_id === user.id;
    return (
      <TouchableOpacity onLongPress={() => reportMsg(m)} activeOpacity={0.9}
        style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginVertical: 3, marginHorizontal: 12 }}>
        {!mine && <Sub style={{ fontSize: 11, marginLeft: 6 }}>{m.avatar_emoji} {m.nickname}</Sub>}
        <View style={{ backgroundColor: mine ? C.pink : C.card2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2 }}>
          <P style={{ fontSize: 14 }}>{m.body}</P>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={{ paddingTop: 0 }}>
      <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: C.border }}>
        <Sub style={{ marginHorizontal: 16 }}>👥 {t('members_here')}: {members.map((m) => `${m.avatar_emoji}${m.nickname}`).join(', ') || '—'}</Sub>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ paddingVertical: 10 }}
        />
        <Row style={{ padding: 8, borderTopWidth: 1, borderColor: C.border }}>
          <Input placeholder={t('type_message')} value={text} onChangeText={setText} style={{ flex: 1, marginVertical: 0, marginHorizontal: 4 }} onSubmitEditing={send} />
          <TouchableOpacity onPress={send} style={{ backgroundColor: C.pink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginRight: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('send')}</Text>
          </TouchableOpacity>
        </Row>
      </KeyboardAvoidingView>
    </Screen>
  );
}
